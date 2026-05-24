/**
 * tests/webrtc/peer.test.js
 *
 * Coverage for the `Peer` wrapper:
 *   - construction guards
 *   - negotiationneeded -> sends `offer` frame with sdp string
 *   - ICE trickle: candidates routed to signaling with `target: peerId`
 *   - ICE cap of 30 candidates, mDNS filter, EOC marker
 *   - incoming `offer` -> sets remote, replies with `answer`
 *   - incoming `answer` -> sets remote, no extra frames
 *   - incoming `ice` -> addIceCandidate
 *   - frames addressed to OTHER peerIds are ignored
 *   - perfect-negotiation collision: impolite peer ignores; polite peer rolls back
 *   - `connectionstatechange = 'failed'` triggers `restartIce()`
 *   - `error` event fires `SdpError` / `IceError` on failures
 *   - `close()` detaches signaling listeners and is idempotent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SignalingClient } from '../../src/webrtc/signaling.js';
import { Peer } from '../../src/webrtc/peer.js';
import { SdpError, IceError, WebRtcError } from '../../src/webrtc/errors.js';
import {
    FakeWebSocket, fakeSockets, resetFakeSockets,
    FakeRTCPeerConnection, fakePeerConnections, resetFakePeerConnections,
} from '../_helpers/webrtcFakes.js';


/** Build a signaling client wired to a freshly opened FakeWebSocket. */
async function makeOpenSignaling() {
    const client = new SignalingClient('ws://localhost/rtc', {
        WebSocket: FakeWebSocket,
        reconnect: false,
    });
    const p = client.connect();
    fakeSockets[0].fakeOpen();
    fakeSockets[0].fakeMessage({ type: 'hello', peerId: 'self_1' });
    await p;
    return client;
}

/** Pick the only `Peer`-owned PC out of the fake registry. */
function lastPc() { return fakePeerConnections[fakePeerConnections.length - 1]; }

/** Helper: extract send frames of a given type from the open socket. */
function sentOfType(type) {
    return fakeSockets[0].sentFrames.filter((f) => f.type === type);
}


describe('Peer (perfect negotiation)', () => {
    beforeEach(() => {
        resetFakeSockets();
        resetFakePeerConnections();
    });

    // -----------------------------------------------------------------------
    // Construction
    // -----------------------------------------------------------------------

    it('throws WebRtcError when peerId is missing', async () => {
        const sig = await makeOpenSignaling();
        expect(() => new Peer('', sig, { RTCPeerConnection: FakeRTCPeerConnection }))
            .toThrowError(WebRtcError);
    });

    it('throws WebRtcError when signaling client is missing', () => {
        expect(() => new Peer('peer_a', null, { RTCPeerConnection: FakeRTCPeerConnection }))
            .toThrowError(WebRtcError);
    });

    it('throws when no RTCPeerConnection is available', async () => {
        const sig = await makeOpenSignaling();
        // No global RTCPeerConnection in vitest jsdom and no override given.
        const originalRTC = globalThis.RTCPeerConnection;
        try {
            delete globalThis.RTCPeerConnection;
            expect(() => new Peer('peer_a', sig)).toThrowError(WebRtcError);
        } finally {
            if (originalRTC) globalThis.RTCPeerConnection = originalRTC;
        }
    });

    it('passes iceServers / rtcConfig through to the PC constructor', async () => {
        const sig = await makeOpenSignaling();
        const iceServers = [{ urls: 'stun:stun.example.com' }];
        new Peer('peer_a', sig, {
            RTCPeerConnection: FakeRTCPeerConnection,
            iceServers,
            rtcConfig: { bundlePolicy: 'max-bundle' },
        });
        expect(lastPc().config.iceServers).toBe(iceServers);
        expect(lastPc().config.bundlePolicy).toBe('max-bundle');
    });

    // -----------------------------------------------------------------------
    // Outbound: negotiationneeded -> offer
    // -----------------------------------------------------------------------

    it('sends an offer frame on negotiationneeded', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });

        await lastPc().fakeNegotiationNeeded();

        const offers = sentOfType('offer');
        expect(offers).toHaveLength(1);
        expect(offers[0].target).toBe('peer_a');
        expect(typeof offers[0].sdp).toBe('string');
        expect(offers[0].sdp).toContain('UDP/TLS/RTP/SAVPF');
        peer.close();
    });

    it('emits SdpError when setLocalDescription throws during offer', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });
        const errors = [];
        peer.on('error', (e) => errors.push(e));

        lastPc().failNextSetLocal = new Error('local boom');
        await lastPc().fakeNegotiationNeeded();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(SdpError);
        expect(errors[0].code).toBe('ZQ_WEBRTC_SDP_OFFER_FAILED');
        peer.close();
    });

    // -----------------------------------------------------------------------
    // Outbound: ICE trickle
    // -----------------------------------------------------------------------

    it('forwards trickled ICE candidates as `ice` frames addressed to peerId', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });

        lastPc().fakeIceCandidate('candidate:1 1 udp 2122260223 192.0.2.1 5000 typ host');
        lastPc().fakeIceCandidate('candidate:2 1 udp 1686052607 198.51.100.1 5001 typ srflx');
        lastPc().fakeIceCandidate(null); // end-of-candidates

        // Bypass coalesce window by reading the queued frames directly: we know
        // signaling.js batches ICE per 200ms - flush by advancing real time...
        // ... or simpler: assert the queue has populated by reading send calls
        // once the timer flushes. Use synchronous expectation on _iceQueue.
        // The SignalingClient buffers ice frames; we don't want to wait timers
        // here, so just verify a deterministic side-effect: at minimum the
        // queue depth matches the candidate count we trickled.
        expect(sig._iceQueue.length).toBe(3);
        expect(sig._iceQueue[0].target).toBe('peer_a');
        expect(typeof sig._iceQueue[0].candidate).toBe('string');
        expect(sig._iceQueue[0].candidate).toContain('typ host');
        expect(sig._iceQueue[2].candidate).toBeNull();
        peer.close();
    });

    it('forwards mDNS (`.local`) candidates so cross-browser LAN peers can connect', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });

        lastPc().fakeIceCandidate('candidate:1 1 udp 2122260223 abcd1234.local 5000 typ host');
        lastPc().fakeIceCandidate('candidate:2 1 udp 1686052607 198.51.100.1 5001 typ srflx');

        expect(sig._iceQueue.length).toBe(2);
        expect(sig._iceQueue[0].candidate).toContain('.local');
        peer.close();
    });

    it('caps trickled candidates at maxIceCandidates', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, {
            RTCPeerConnection: FakeRTCPeerConnection,
            maxIceCandidates: 3,
        });

        for (let i = 0; i < 10; i++) {
            lastPc().fakeIceCandidate(`candidate:${i} 1 udp 2122260223 192.0.2.${i} 5000 typ host`);
        }
        // EOC marker is always allowed past the cap.
        lastPc().fakeIceCandidate(null);

        const iceFrames = sig._iceQueue;
        const nonNull = iceFrames.filter((f) => f.candidate !== null);
        expect(nonNull.length).toBe(3);
        expect(iceFrames.some((f) => f.candidate === null)).toBe(true);
        peer.close();
    });

    // -----------------------------------------------------------------------
    // Inbound: offer / answer / ice
    // -----------------------------------------------------------------------

    it('answers a remote offer and routes it through signaling', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });

        fakeSockets[0].fakeMessage({ type: 'offer', from: 'peer_a', sdp: 'remote-sdp-blob' });
        // setRemoteDescription + setLocalDescription are awaited inside the
        // handler; yield two microtasks.
        await Promise.resolve(); await Promise.resolve();

        expect(lastPc().setRemoteCalls).toHaveLength(1);
        expect(lastPc().setRemoteCalls[0]).toEqual({ type: 'offer', sdp: 'remote-sdp-blob' });
        const answers = sentOfType('answer');
        expect(answers).toHaveLength(1);
        expect(answers[0].target).toBe('peer_a');
        expect(typeof answers[0].sdp).toBe('string');
        peer.close();
    });

    it('applies a remote answer and sends nothing further', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });

        // Pretend we previously offered.
        lastPc().signalingState = 'have-local-offer';
        fakeSockets[0].fakeMessage({ type: 'answer', from: 'peer_a', sdp: 'remote-answer-sdp' });
        await Promise.resolve(); await Promise.resolve();

        expect(lastPc().setRemoteCalls).toHaveLength(1);
        expect(lastPc().setRemoteCalls[0].type).toBe('answer');
        expect(sentOfType('answer')).toHaveLength(0);
        expect(sentOfType('offer')).toHaveLength(0);
        peer.close();
    });

    it('adds remote ICE candidates and the EOC marker', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });

        fakeSockets[0].fakeMessage({ type: 'ice', from: 'peer_a', candidate: 'candidate:7 1 udp 1 192.0.2.7 5000 typ host' });
        fakeSockets[0].fakeMessage({ type: 'ice', from: 'peer_a', candidate: null });
        await Promise.resolve(); await Promise.resolve();

        expect(lastPc().addIceCandidateCalls).toHaveLength(2);
        expect(lastPc().addIceCandidateCalls[0]).toEqual({
            candidate:     'candidate:7 1 udp 1 192.0.2.7 5000 typ host',
            sdpMid:        '',
            sdpMLineIndex: 0,
        });
        expect(lastPc().addIceCandidateCalls[1]).toBeNull();
        peer.close();
    });

    it('ignores frames addressed to a different remote peer', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });

        fakeSockets[0].fakeMessage({ type: 'offer', from: 'peer_b', sdp: 'other' });
        fakeSockets[0].fakeMessage({ type: 'ice',   from: 'peer_b', candidate: 'foo' });
        await Promise.resolve(); await Promise.resolve();

        expect(lastPc().setRemoteCalls).toHaveLength(0);
        expect(lastPc().addIceCandidateCalls).toHaveLength(0);
        peer.close();
    });

    // -----------------------------------------------------------------------
    // Perfect negotiation collision
    // -----------------------------------------------------------------------

    it('impolite peer ignores a colliding remote offer', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, {
            RTCPeerConnection: FakeRTCPeerConnection,
            polite: false,
        });

        // Simulate an in-flight local offer.
        peer.makingOffer = true;
        fakeSockets[0].fakeMessage({ type: 'offer', from: 'peer_a', sdp: 'collide' });
        await Promise.resolve(); await Promise.resolve();

        expect(peer.ignoreOffer).toBe(true);
        expect(lastPc().setRemoteCalls).toHaveLength(0);
        expect(sentOfType('answer')).toHaveLength(0);
        peer.close();
    });

    it('polite peer accepts a colliding remote offer and answers', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, {
            RTCPeerConnection: FakeRTCPeerConnection,
            polite: true,
        });

        peer.makingOffer = true;
        fakeSockets[0].fakeMessage({ type: 'offer', from: 'peer_a', sdp: 'collide' });
        await Promise.resolve(); await Promise.resolve();

        expect(peer.ignoreOffer).toBe(false);
        expect(lastPc().setRemoteCalls).toHaveLength(1);
        expect(sentOfType('answer')).toHaveLength(1);
        peer.close();
    });

    it('suppresses addIceCandidate errors while ignoring a glare offer', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, {
            RTCPeerConnection: FakeRTCPeerConnection,
            polite: false,
        });
        const errors = [];
        peer.on('error', (e) => errors.push(e));

        peer.ignoreOffer = true;
        lastPc().failNextAddIce = new Error('stale');
        fakeSockets[0].fakeMessage({ type: 'ice', from: 'peer_a', candidate: 'candidate:foo' });
        await Promise.resolve(); await Promise.resolve();

        expect(errors).toHaveLength(0);
        peer.close();
    });

    // -----------------------------------------------------------------------
    // restartIce / lifecycle
    // -----------------------------------------------------------------------

    it('calls restartIce() when connectionState transitions to failed', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });
        const states = [];
        peer.on('connectionstatechange', (s) => states.push(s));

        lastPc().fakeConnectionStateChange('failed');

        expect(states).toEqual(['failed']);
        expect(lastPc().restartIceCount).toBe(1);
        peer.close();
    });

    it('forwards track and datachannel events to listeners', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });
        const tracks = []; const dcs = [];
        peer.on('track', (e) => tracks.push(e));
        peer.on('datachannel', (e) => dcs.push(e));

        lastPc().fakeTrack();
        lastPc().fakeDataChannel({ label: 'chat' });

        expect(tracks).toHaveLength(1);
        expect(dcs).toHaveLength(1);
        expect(dcs[0].channel.label).toBe('chat');
        peer.close();
    });

    it('emits IceError when restartIce() throws', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });
        const errors = [];
        peer.on('error', (e) => errors.push(e));

        lastPc().restartIce = () => { throw new Error('cannot restart'); };
        peer.restartIce();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(IceError);
        expect(errors[0].code).toBe('ZQ_WEBRTC_ICE_RESTART_FAILED');
        peer.close();
    });

    it('close() detaches signaling listeners and is idempotent', async () => {
        const sig = await makeOpenSignaling();
        const peer = new Peer('peer_a', sig, { RTCPeerConnection: FakeRTCPeerConnection });
        let closeFired = 0;
        peer.on('close', () => closeFired++);

        peer.close();
        peer.close(); // second call no-op
        expect(closeFired).toBe(1);
        expect(lastPc().closeCalls).toBe(1);

        // Further inbound frames must not touch the (closed) PC.
        fakeSockets[0].fakeMessage({ type: 'offer', from: 'peer_a', sdp: 'late' });
        await Promise.resolve(); await Promise.resolve();
        expect(lastPc().setRemoteCalls).toHaveLength(0);
    });
});
