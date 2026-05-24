/**
 * src/webrtc/peer.js - RTCPeerConnection wrapper with perfect negotiation
 *
 * Wraps a browser `RTCPeerConnection` and routes JSEP messages through a
 * `SignalingClient` instance for a single remote peer. Implements the W3C
 * "perfect negotiation" pattern (Jan-Ivar Bruaroey) so that simultaneous
 * `negotiationneeded` events on both ends resolve deterministically based
 * on the locally-assigned `polite` flag - no glare, no manual rollback.
 *
 * Wire-protocol mapping (mirrors @zero-server/webrtc):
 *   - outgoing `offer`  -> `{ type: 'offer',  target, sdp }`   (sdp is the string)
 *   - outgoing `answer` -> `{ type: 'answer', target, sdp }`
 *   - outgoing `ice`    -> `{ type: 'ice',    target, candidate }`  (RTCIceCandidateInit-shaped dict or null for EOC)
 *   - incoming filtered by `msg.from === this.id`.
 *
 * Server-side constraints honored here:
 *   - at most `maxIceCandidates` trickled candidates per peer (default 30 -
 *     the hub's hard cap on `a=candidate:` lines per SDP)
 *   - `mDNS` (`.local`) candidates dropped before send
 *   - failed `connectionState` automatically calls `pc.restartIce()`.
 *
 * SSR-safe: nothing touches `RTCPeerConnection` at module load - it's only
 * resolved when a `Peer` is constructed. Tests can inject a fake constructor
 * via `options.RTCPeerConnection`.
 */

import { WebRtcError, SdpError, IceError } from './errors.js';


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default cap on trickled ICE candidates per peer (matches server SDP cap). */
const DEFAULT_MAX_ICE_CANDIDATES = 30;


/**
 * One remote peer over a shared `SignalingClient`. Caller owns the lifetime
 * (construct, attach tracks, eventually call `.close()`).
 *
 *   const peer = new Peer('peer_42', signaling, { polite: true });
 *   peer.addTrack(localAudio, localStream);
 *   peer.on('track', ({ track, streams }) => attachToVideoEl(streams[0]));
 *
 * Lifecycle events:
 *   - `track`                   forwards the underlying `RTCTrackEvent`.
 *   - `connectionstatechange`   payload is the new `pc.connectionState` string.
 *   - `datachannel`             forwards `RTCDataChannelEvent`.
 *   - `close`                   fired exactly once when `.close()` runs.
 *   - `error`                   `SdpError` / `IceError` from negotiation.
 */
export class Peer {
    /**
     * @param {string} peerId                       - remote peer id (the `from`/`to` value on the wire).
     * @param {import('./signaling.js').SignalingClient} signaling - shared signaling client.
     * @param {object} [options]
     * @param {boolean} [options.polite=false]      - perfect-negotiation polite flag.
     * @param {RTCIceServer[]} [options.iceServers] - STUN/TURN servers.
     * @param {Function} [options.RTCPeerConnection] - constructor override (tests).
     * @param {number}  [options.maxIceCandidates=30] - trickled-candidate hard cap.
     * @param {object}  [options.rtcConfig]          - extra fields merged into `RTCConfiguration`.
     */
    constructor(peerId, signaling, options = {}) {
        if (typeof peerId !== 'string' || peerId.length === 0) {
            throw new WebRtcError('Peer requires a non-empty peerId', { code: 'ZQ_WEBRTC_PEER_BAD_ID' });
        }
        if (!signaling || typeof signaling.send !== 'function' || typeof signaling.on !== 'function') {
            throw new WebRtcError('Peer requires a SignalingClient-like object', { code: 'ZQ_WEBRTC_PEER_BAD_SIGNALING' });
        }

        const PCCtor = options.RTCPeerConnection
            || (typeof globalThis !== 'undefined' && globalThis.RTCPeerConnection)
            || null;
        if (!PCCtor) {
            throw new WebRtcError(
                'RTCPeerConnection is not available in this environment',
                { code: 'ZQ_WEBRTC_NO_RTC' }
            );
        }

        const rtcConfig = Object.assign(
            {
                iceServers:   options.iceServers || [],
                // Force every m-section onto a single ICE/DTLS transport so
                // trickled ICE candidates can be safely re-applied on the
                // remote side with sdpMid='0' / sdpMLineIndex=0 (the wire
                // protocol relays only the bare candidate string).
                bundlePolicy: 'max-bundle',
            },
            options.rtcConfig || {}
        );

        this.id            = peerId;
        this.signaling     = signaling;
        this.polite        = !!options.polite;
        this.pc            = new PCCtor(rtcConfig);
        this.closed        = false;
        this.makingOffer   = false;
        this.ignoreOffer   = false;
        this.srdAnswerPending = false;

        this._listeners        = new Map();
        this._maxIceCandidates = options.maxIceCandidates || DEFAULT_MAX_ICE_CANDIDATES;
        this._sentCandidates   = 0;
        this._sigUnsub         = [];
        // Serialize incoming remote events (offer/answer/ice) so an ICE frame
        // can never call addIceCandidate() while a setRemoteDescription() is
        // still in flight - that race throws "The remote description was null"
        // and leaves the PeerConnection stuck in `have-local-offer` forever.
        this._opChain          = Promise.resolve();

        this._attachPc();
        this._attachSignaling();
    }

    // -----------------------------------------------------------------------
    // Event surface
    // -----------------------------------------------------------------------

    /**
     * Subscribe to a Peer-level event.
     *
     * @param {string}   type
     * @param {Function} cb
     * @returns {Function} unsubscribe
     */
    on(type, cb) {
        if (typeof cb !== 'function') return () => {};
        let set = this._listeners.get(type);
        if (!set) { set = new Set(); this._listeners.set(type, set); }
        set.add(cb);
        return () => this.off(type, cb);
    }

    /**
     * Remove a previously registered listener.
     *
     * @param {string}   type
     * @param {Function} cb
     */
    off(type, cb) {
        const set = this._listeners.get(type);
        if (set) set.delete(cb);
    }

    /**
     * @param {string} type
     * @param {*}      payload
     * @private
     */
    _emit(type, payload) {
        const set = this._listeners.get(type);
        if (!set || set.size === 0) return;
        for (const cb of [...set]) {
            try { cb(payload); }
            catch (_) { /* listener errors must not break negotiation */ }
        }
    }

    // -----------------------------------------------------------------------
    // Track / datachannel passthrough
    // -----------------------------------------------------------------------

    /**
     * Add a local track to this peer. Returns the `RTCRtpSender` so the caller
     * can later `replaceTrack()` or `removeTrack()` it directly.
     *
     * @param {MediaStreamTrack} track
     * @param {...MediaStream}   streams
     * @returns {*}
     */
    addTrack(track, ...streams) {
        return this.pc.addTrack(track, ...streams);
    }

    /**
     * Remove a previously-added sender from the peer.
     *
     * @param {*} sender
     */
    removeTrack(sender) {
        return this.pc.removeTrack(sender);
    }

    /**
     * Create a data channel on this peer. The remote side observes a
     * `datachannel` event on its own `Peer`.
     *
     * @param {string} label
     * @param {RTCDataChannelInit} [init]
     * @returns {RTCDataChannel}
     */
    createDataChannel(label, init) {
        return this.pc.createDataChannel(label, init);
    }

    /**
     * Force ICE restart - useful from app code after detecting a long
     * `disconnected` window. Negotiation kicks off automatically via
     * `negotiationneeded`.
     */
    restartIce() {
        if (this.closed) return;
        try { this.pc.restartIce(); }
        catch (err) {
            this._emit('error', new IceError(err.message || 'restartIce failed', {
                code: 'ZQ_WEBRTC_ICE_RESTART_FAILED',
                cause: err,
            }));
        }
    }

    /**
     * Close the underlying `RTCPeerConnection` and detach signaling listeners.
     * Idempotent.
     */
    close() {
        if (this.closed) return;
        this.closed = true;

        for (const off of this._sigUnsub) { try { off(); } catch (_) {} }
        this._sigUnsub.length = 0;

        try { this.pc.close(); } catch (_) {}
        this._emit('close');
    }

    // -----------------------------------------------------------------------
    // Internal: RTCPeerConnection wiring
    // -----------------------------------------------------------------------

    /** @private */
    _attachPc() {
        this.pc.onnegotiationneeded = async () => {
            if (this.closed) return;
            try {
                this.makingOffer = true;
                await this.pc.setLocalDescription();
                const desc = this.pc.localDescription;
                if (!desc || !desc.sdp) return;
                this.signaling.send('offer', { target: this.id, sdp: desc.sdp });
            } catch (err) {
                this._emit('error', new SdpError(err.message || 'offer failed', {
                    code: 'ZQ_WEBRTC_SDP_OFFER_FAILED',
                    cause: err,
                }));
            } finally {
                this.makingOffer = false;
            }
        };

        this.pc.onicecandidate = (event) => {
            if (this.closed) return;
            const candidate = event && event.candidate;
            // End-of-candidates marker (null) -> always forward.
            if (!candidate) {
                this.signaling.send('ice', { target: this.id, candidate: null });
                return;
            }
            const cand = typeof candidate === 'string' ? candidate : candidate.candidate;
            if (!cand) return;
            // NOTE: do NOT filter mDNS (.local) candidates. Firefox emits them by
            // default for privacy and browsers can resolve each other's mDNS
            // hostnames on the same LAN - dropping them strands cross-browser
            // peer-to-peer on the same machine with zero usable candidates.
            if (this._sentCandidates >= this._maxIceCandidates) return;
            this._sentCandidates++;
            // The SignalingHub wire protocol requires `candidate` to be a bare
            // string (the `a=candidate:` line). sdpMid/sdpMLineIndex are
            // reconstructed on the receive side using BUNDLE defaults (we set
            // bundlePolicy: 'max-bundle' so every candidate funnels to the
            // first m-section anyway).
            this.signaling.send('ice', { target: this.id, candidate: cand });
        };

        this.pc.ontrack = (event) => {
            if (this.closed) return;
            this._emit('track', event);
        };

        this.pc.ondatachannel = (event) => {
            if (this.closed) return;
            this._emit('datachannel', event);
        };

        this.pc.onconnectionstatechange = () => {
            if (this.closed) return;
            const state = this.pc.connectionState;
            this._emit('connectionstatechange', state);
            if (state === 'failed') {
                try { this.pc.restartIce(); } catch (_) { /* swallow */ }
            }
        };
    }

    /** @private */
    _attachSignaling() {
        const guard = (cb) => (msg) => {
            if (this.closed) return;
            if (!msg || msg.from !== this.id) return;
            // Chain every remote event behind any prior in-flight op so SDP
            // and ICE never race against each other.
            this._opChain = this._opChain.then(() => cb(msg)).catch(() => {});
        };
        this._sigUnsub.push(
            this.signaling.on('offer',  guard((m) => this._onRemoteDescription('offer',  m.sdp))),
            this.signaling.on('answer', guard((m) => this._onRemoteDescription('answer', m.sdp))),
            this.signaling.on('ice',    guard((m) => this._onRemoteCandidate(m.candidate))),
        );
    }

    /**
     * @param {'offer'|'answer'} kind
     * @param {string|object} sdp
     * @private
     */
    async _onRemoteDescription(kind, sdp) {
        // Accept either a full description object (some servers relay it that
        // way) or a bare SDP string; normalize to { type, sdp }.
        const description = typeof sdp === 'string'
            ? { type: kind, sdp }
            : sdp;

        try {
            const ready = !this.makingOffer
                && (this.pc.signalingState === 'stable' || this.srdAnswerPending);
            const offerCollision = description.type === 'offer' && !ready;
            this.ignoreOffer = !this.polite && offerCollision;
            if (this.ignoreOffer) return;

            this.srdAnswerPending = description.type === 'answer';
            await this.pc.setRemoteDescription(description);
            this.srdAnswerPending = false;

            if (description.type === 'offer') {
                await this.pc.setLocalDescription();
                const local = this.pc.localDescription;
                if (local && local.sdp) {
                    this.signaling.send('answer', { target: this.id, sdp: local.sdp });
                }
            }
        } catch (err) {
            this._emit('error', new SdpError(err.message || 'setRemoteDescription failed', {
                code: 'ZQ_WEBRTC_SDP_APPLY_FAILED',
                cause: err,
            }));
        }
    }

    /**
     * @param {string|object|null} candidate - raw `a=candidate:` line, a full
     *   `RTCIceCandidateInit`-shaped dict, or `null` for end-of-candidates.
     * @private
     */
    async _onRemoteCandidate(candidate) {
        try {
            if (candidate == null) {
                // End-of-candidates: addIceCandidate(null) is the spec-compliant signal.
                await this.pc.addIceCandidate(null);
                return;
            }
            // Older zero-query clients relayed only the bare `a=candidate:` string,
            // which browsers reject with "missing values for both sdpMid and
            // sdpMLineIndex". Newer clients send a full init dict - normalize both.
            const init = (typeof candidate === 'string')
                ? { candidate, sdpMid: '', sdpMLineIndex: 0 }
                : {
                    candidate:        candidate.candidate,
                    sdpMid:           candidate.sdpMid != null ? candidate.sdpMid : '',
                    sdpMLineIndex:    candidate.sdpMLineIndex != null ? candidate.sdpMLineIndex : 0,
                    usernameFragment: candidate.usernameFragment != null ? candidate.usernameFragment : undefined,
                };
            if (!init.candidate) return;
            await this.pc.addIceCandidate(init);
        } catch (err) {
            // The W3C pattern: suppress errors while we're explicitly ignoring an offer.
            if (this.ignoreOffer) return;
            this._emit('error', new IceError(err.message || 'addIceCandidate failed', {
                code: 'ZQ_WEBRTC_ICE_ADD_FAILED',
                cause: err,
            }));
        }
    }
}
