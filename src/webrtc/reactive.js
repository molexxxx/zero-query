/**
 * src/webrtc/reactive.js - reactive composables on top of `Room`
 *
 * Thin wrappers that adapt the Room / Peer surface into the project's
 * `signal()`/`effect()` primitives. They mirror the surface described in
 * the roadmap: `useRoom`, `usePeer`, `useTracks`, `useDataChannel`, and
 * `useConnectionQuality`. Each returns either a `Signal` (cleanup via the
 * room's `leave()`) or a small object with a `.close()` / `.dispose()`
 * method - callers manage lifetime explicitly since the component runtime
 * does not currently expose `onCleanup`.
 */

import { signal } from '../reactive.js';
import { Room, join } from './room.js';
import { WebRtcError } from './errors.js';


/**
 * Join a room and return a Promise that resolves to a `Room` whose
 * `peers` / `localTracks` signals can be consumed directly. The returned
 * Promise also exposes a `.dispose()` shortcut (`room.leave()`); when the
 * room is closed, signals stop updating.
 *
 * Two call shapes:
 *   useRoom(url, opts)                  → join via signaling
 *   useRoom(roomInstance)               → wrap an existing Room (composability)
 *
 * @param {string|Room} urlOrRoom
 * @param {object} [opts]
 * @returns {Promise<Room>}
 */
export function useRoom(urlOrRoom, opts) {
    if (urlOrRoom instanceof Room) {
        return Promise.resolve(urlOrRoom);
    }
    if (typeof urlOrRoom !== 'string') {
        return Promise.reject(new WebRtcError(
            'useRoom: first argument must be a signaling URL or a Room',
            { code: 'ZQ_WEBRTC_USE_ROOM_BAD_ARG' }
        ));
    }
    return join(urlOrRoom, opts || {});
}


/**
 * Reactive view of a single remote peer.
 *
 * @param {Room} room
 * @param {string} peerId
 * @returns {{ readonly value: object | null, dispose: () => void }}
 *   A getter-only signal-like with `.value` (the PeerInfo or `null` if absent)
 *   and `.dispose()` to stop listening.
 */
export function usePeer(room, peerId) {
    if (!(room instanceof Room)) {
        throw new WebRtcError('usePeer: room must be a Room instance', { code: 'ZQ_WEBRTC_USE_PEER_BAD_ROOM' });
    }
    if (typeof peerId !== 'string' || peerId.length === 0) {
        throw new WebRtcError('usePeer: peerId must be a non-empty string', { code: 'ZQ_WEBRTC_USE_PEER_BAD_ID' });
    }

    const out = signal(null);
    const refresh = () => {
        const map = room.peers.peek();
        const info = map.get(peerId) || null;
        if (info !== out.peek()) out.value = info;
    };
    refresh();
    const unsub = room.peers.subscribe(refresh);
    return {
        get value() { return out.value; },
        peek() { return out.peek(); },
        subscribe(cb) { return out.subscribe(cb); },
        dispose() { try { unsub(); } catch (_) {} },
    };
}


/**
 * Reactive list of a peer's currently-attached `MediaStreamTrack`s.
 *
 * @param {object} peerInfo - The PeerInfo object yielded by `room.peers`.
 * @returns {{ readonly value: MediaStreamTrack[], dispose: () => void }}
 */
export function useTracks(peerInfo) {
    if (!peerInfo || !peerInfo.stream) {
        throw new WebRtcError('useTracks: peerInfo.stream is required', { code: 'ZQ_WEBRTC_USE_TRACKS_BAD_PEER' });
    }
    const sig = signal(_safeGetTracks(peerInfo.stream));

    const refresh = () => {
        const next = _safeGetTracks(peerInfo.stream);
        // Replace the array reference so subscribers always notify.
        sig.value = next;
    };

    let unsub = null;
    const stream = peerInfo.stream;
    if (typeof stream.addEventListener === 'function') {
        stream.addEventListener('addtrack', refresh);
        stream.addEventListener('removetrack', refresh);
        unsub = () => {
            try { stream.removeEventListener('addtrack', refresh); } catch (_) {}
            try { stream.removeEventListener('removetrack', refresh); } catch (_) {}
        };
    }

    return {
        get value() { return sig.value; },
        peek() { return sig.peek(); },
        subscribe(cb) { return sig.subscribe(cb); },
        /** Manually re-sample (useful in tests / environments without addtrack events). */
        refresh,
        dispose() { if (unsub) unsub(); },
    };
}


/**
 * Reactive data-channel wrapper backed by `room.dataChannel(label)`.
 *
 * @param {Room} room
 * @param {string} label
 * @param {{ history?: number, opts?: RTCDataChannelInit }} [opts]
 * @returns {{
 *   messages: { readonly value: Array<{ data: any, from: string, at: number }>, peek: () => any[], subscribe: (cb: Function) => () => void },
 *   send: (data: any) => void,
 *   close: () => void,
 *   dispose: () => void,
 * }}
 */
export function useDataChannel(room, label, opts) {
    if (!(room instanceof Room)) {
        throw new WebRtcError('useDataChannel: room must be a Room instance', { code: 'ZQ_WEBRTC_USE_DC_BAD_ROOM' });
    }
    if (typeof label !== 'string' || label.length === 0) {
        throw new WebRtcError('useDataChannel: label must be a non-empty string', { code: 'ZQ_WEBRTC_USE_DC_BAD_LABEL' });
    }
    const history = opts && typeof opts.history === 'number' ? opts.history : 100;
    const wrap = room.dataChannel(label, opts && opts.opts);

    const messages = signal([]);
    const off = wrap.on('message', (data, from) => {
        const entry = { data, from, at: Date.now() };
        const next = messages.peek().slice();
        next.push(entry);
        if (next.length > history) next.splice(0, next.length - history);
        messages.value = next;
    });

    return {
        messages: {
            get value() { return messages.value; },
            peek() { return messages.peek(); },
            subscribe(cb) { return messages.subscribe(cb); },
        },
        send(data) { wrap.send(data); },
        close() {
            try { off(); } catch (_) {}
            try { wrap.close(); } catch (_) {}
        },
        dispose() {
            try { off(); } catch (_) {}
        },
    };
}


/**
 * Periodically sample `peer.pc.getStats()` and map the result to a
 * three-bucket connection quality classifier. Returns a signal-like with
 * `.value` and `.dispose()` for cleanup.
 *
 * Heuristic (intentionally simple - more nuance lands with the
 * observability pass):
 *   - 'good' if packetLossPct < 2 AND rtt < 200
 *   - 'fair' if packetLossPct < 10 AND rtt < 500
 *   - else 'poor'
 *
 * @param {object} peerInfo - PeerInfo from `room.peers`.
 * @param {{ intervalMs?: number, getStats?: () => Promise<any> }} [opts]
 * @returns {{ readonly value: 'good'|'fair'|'poor', dispose: () => void }}
 */
export function useConnectionQuality(peerInfo, opts) {
    if (!peerInfo || !peerInfo.pc) {
        throw new WebRtcError('useConnectionQuality: peerInfo.pc is required', { code: 'ZQ_WEBRTC_USE_CQ_BAD_PEER' });
    }
    const intervalMs = opts && typeof opts.intervalMs === 'number' ? opts.intervalMs : 2000;
    const sampler = opts && typeof opts.getStats === 'function'
        ? opts.getStats
        : () => peerInfo.pc.getStats();

    const sig = signal('good');
    let stopped = false;

    const sample = async () => {
        if (stopped) return;
        try {
            const report = await sampler();
            const q = _classifyStats(report);
            if (q !== sig.peek()) sig.value = q;
        } catch (_) {
            // sampling failures don't change the bucket
        }
    };

    sample();
    const timer = setInterval(sample, intervalMs);

    return {
        get value() { return sig.value; },
        peek() { return sig.peek(); },
        subscribe(cb) { return sig.subscribe(cb); },
        dispose() {
            stopped = true;
            clearInterval(timer);
        },
    };
}


// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function _safeGetTracks(stream) {
    if (stream && typeof stream.getTracks === 'function') {
        try { return stream.getTracks(); }
        catch (_) { return []; }
    }
    return [];
}

/**
 * Convert a `getStats()` report to a `'good' | 'fair' | 'poor'` bucket.
 * The report can be a `RTCStatsReport`-like (Map / iterable of stat objects)
 * or a plain object map.
 */
function _classifyStats(report) {
    const stats = [];
    if (report && typeof report.forEach === 'function') {
        report.forEach((v) => stats.push(v));
    } else if (report && typeof report === 'object') {
        for (const k of Object.keys(report)) stats.push(report[k]);
    }

    let inbound = null;
    let pair = null;
    for (const s of stats) {
        if (!s || typeof s !== 'object') continue;
        if (s.type === 'inbound-rtp' && !inbound) inbound = s;
        if (s.type === 'candidate-pair' && (s.state === 'succeeded' || s.nominated)) pair = s;
    }

    let lossPct = 0;
    if (inbound && typeof inbound.packetsLost === 'number' && typeof inbound.packetsReceived === 'number') {
        const total = inbound.packetsLost + inbound.packetsReceived;
        lossPct = total > 0 ? (inbound.packetsLost / total) * 100 : 0;
    }
    const rttMs = pair && typeof pair.currentRoundTripTime === 'number'
        ? pair.currentRoundTripTime * 1000
        : 0;

    if (lossPct < 2 && rttMs < 200) return 'good';
    if (lossPct < 10 && rttMs < 500) return 'fair';
    return 'poor';
}
