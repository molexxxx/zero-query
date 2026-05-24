/**
 * tests/webrtc/room.test.js
 *
 * Coverage for the high-level `Room` class and the `webrtc.join()`
 * orchestrator:
 *   - construction guards
 *   - signaling `peer-joined` / `peer-left` mutate the `peers` Signal
 *   - perfect-negotiation polite flag derived from lex comparison
 *   - publish() adds tracks to every existing peer and remembers them
 *   - publish before join: new peers receive remembered tracks
 *   - unpublish() removes the sender on every peer
 *   - dataChannel() opens a channel on every peer + on later joiners
 *   - dataChannel send() broadcasts; on('message') fans-in from all peers
 *   - peer's `track` event updates PeerInfo audio/video flags
 *   - leave() closes every peer, sends `leave`, becomes idempotent
 *   - event bus delivers `peer-joined`, `peer-left`, `error`
 *   - join() handshake: connect → hello → join → joined → roster bootstrap
 *   - join() timeout error code
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Room, join } from '../../src/webrtc/room.js';
import { Peer } from '../../src/webrtc/peer.js';
import { SignalingClient } from '../../src/webrtc/signaling.js';
import { WebRtcError } from '../../src/webrtc/errors.js';
import {
    FakeWebSocket, fakeSockets, resetFakeSockets,
    FakeRTCPeerConnection, fakePeerConnections, resetFakePeerConnections,
} from '../_helpers/webrtcFakes.js';


/** Build a signaling client wired to a freshly opened FakeWebSocket. */
async function openSignaling(selfId = 'self_z') {
    const client = new SignalingClient('ws://localhost/rtc', {
        WebSocket: FakeWebSocket,
        reconnect: false,
    });
    const p = client.connect();
    fakeSockets[0].fakeOpen();
    fakeSockets[0].fakeMessage({ type: 'hello', peerId: selfId });
    await p;
    return client;
}

function makeRoom(selfId = 'self_z') {
    return openSignaling(selfId).then((signaling) => new Room({
        id: 'room1',
        self: selfId,
        signaling,
        peerOptions: { RTCPeerConnection: FakeRTCPeerConnection },
    }));
}


describe('Room (construction guards)', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('throws when id is missing', async () => {
        const sig = await openSignaling();
        expect(() => new Room({ id: '', self: 'a', signaling: sig })).toThrow(WebRtcError);
    });

    it('throws when self is missing', async () => {
        const sig = await openSignaling();
        expect(() => new Room({ id: 'r', self: '', signaling: sig })).toThrow(WebRtcError);
    });

    it('throws when signaling is missing', () => {
        expect(() => new Room({ id: 'r', self: 'a', signaling: null })).toThrow(WebRtcError);
    });
});


describe('Room (mesh management)', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('adds a peer when signaling emits peer-joined', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        expect(room.peers.peek().size).toBe(1);
        const info = room.peers.peek().get('peer_a');
        expect(info).toBeDefined();
        expect(info.id).toBe('peer_a');
        expect(info.peer).toBeInstanceOf(Peer);
        expect(info.connection).toBe('new');
    });

    it('ignores duplicate peer-joined frames', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        expect(room.peers.peek().size).toBe(1);
    });

    it('ignores a peer-joined frame for self', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'self_z' });
        expect(room.peers.peek().size).toBe(0);
    });

    it('derives polite from lex compare (self > remote → polite)', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        expect(room.peers.peek().get('peer_a').peer.polite).toBe(true);
    });

    it('derives polite from lex compare (self < remote → impolite)', async () => {
        const room = await makeRoom('aa_self');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'zz_peer' });
        expect(room.peers.peek().get('zz_peer').peer.polite).toBe(false);
    });

    it('removes a peer on peer-left and closes its PC', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        const info = room.peers.peek().get('peer_a');
        fakeSockets[0].fakeMessage({ type: 'peer-left', id: 'peer_a' });
        expect(room.peers.peek().size).toBe(0);
        expect(info.peer.pc.closeCalls).toBe(1);
    });

    it('notifies subscribers when peers mutate', async () => {
        const room = await makeRoom('self_z');
        let snapshots = 0;
        const unsub = room.peers.subscribe(() => { snapshots++; });
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_b' });
        fakeSockets[0].fakeMessage({ type: 'peer-left',   id: 'peer_a' });
        unsub();
        expect(snapshots).toBe(3);
    });
});


describe('Room (publish / unpublish)', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    function fakeStream(tracks) {
        return { id: 'stream_fake', getTracks: () => tracks.slice() };
    }

    it('publish() addTrack on every existing peer', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_b' });

        const t1 = { kind: 'audio', id: 't1' };
        await room.publish(fakeStream([t1]));

        const a = room.peers.peek().get('peer_a').pc;
        const b = room.peers.peek().get('peer_b').pc;
        expect(a.addTrackCalls).toHaveLength(1);
        expect(b.addTrackCalls).toHaveLength(1);
        expect(a.addTrackCalls[0].track).toBe(t1);
        expect(room.localTracks.peek()).toEqual([t1]);
    });

    it('publish() then late peer-joined → late peer also receives the track', async () => {
        const room = await makeRoom('self_z');
        const t1 = { kind: 'video', id: 't1' };
        await room.publish(fakeStream([t1]));

        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        const a = room.peers.peek().get('peer_a').pc;
        expect(a.addTrackCalls).toHaveLength(1);
        expect(a.addTrackCalls[0].track).toBe(t1);
    });

    it('publish() is idempotent for the same track', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        const t1 = { kind: 'audio', id: 't1' };
        await room.publish(fakeStream([t1]));
        await room.publish(fakeStream([t1]));
        expect(room.peers.peek().get('peer_a').pc.addTrackCalls).toHaveLength(1);
    });

    it('unpublish() removes the sender on every peer', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        const t1 = { kind: 'audio', id: 't1' };
        const stream = fakeStream([t1]);
        await room.publish(stream);
        await room.unpublish(stream);
        const a = room.peers.peek().get('peer_a').pc;
        expect(a.removeTrackCalls).toHaveLength(1);
        expect(room.localTracks.peek()).toEqual([]);
    });

    it('publish() rejects a non-MediaStream argument', async () => {
        const room = await makeRoom('self_z');
        await expect(room.publish(null)).rejects.toThrow(WebRtcError);
    });
});


describe('Room (dataChannel multiplex)', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('returns the same wrapper for the same label', async () => {
        const room = await makeRoom('self_z');
        const a = room.dataChannel('chat');
        const b = room.dataChannel('chat');
        expect(a).toBe(b);
    });

    it('opens the channel on every existing peer + every late joiner (self is lex-smaller)', async () => {
        const room = await makeRoom('aaa_self');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'zzz_b' });
        const dc = room.dataChannel('chat', { ordered: true });

        const a = room.peers.peek().get('zzz_b').pc;
        expect(a.dataChannelCalls).toHaveLength(1);
        expect(a.dataChannelCalls[0].label).toBe('chat');

        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'zzz_c' });
        const b = room.peers.peek().get('zzz_c').pc;
        expect(b.dataChannelCalls).toHaveLength(1);
        expect(b.dataChannelCalls[0].label).toBe('chat');
        void dc;
    });

    it('glare guard: lex-larger self waits for ondatachannel instead of creating', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        const dc = room.dataChannel('chat');

        // self_z >= peer_a, so we do NOT create the channel locally.
        const pc = room.peers.peek().get('peer_a').pc;
        expect(pc.dataChannelCalls).toHaveLength(0);

        // When the remote opens its channel, we adopt it and route events.
        const received = [];
        dc.on('message', (data, from) => received.push({ data, from }));
        const fakeDc = { label: 'chat', onmessage: null, send() {} };
        pc.fakeDataChannel(fakeDc);
        fakeDc.onmessage({ data: 'hi' });
        expect(received).toEqual([{ data: 'hi', from: 'peer_a' }]);
    });

    it('send() broadcasts to every per-peer channel', async () => {
        const room = await makeRoom('aaa_self');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'zzz_b' });
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'zzz_c' });
        const dc = room.dataChannel('chat');

        const sendsA = [];
        const sendsB = [];
        const aPc = room.peers.peek().get('zzz_b').pc;
        const bPc = room.peers.peek().get('zzz_c').pc;
        aPc.dataChannelCalls[0].send = (d) => sendsA.push(d);
        bPc.dataChannelCalls[0].send = (d) => sendsB.push(d);

        dc.send('hello');
        expect(sendsA).toEqual(['hello']);
        expect(sendsB).toEqual(['hello']);
    });

    it('on("message") fans-in from every peer with (data, peerId)', async () => {
        const room = await makeRoom('aaa_self');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'zzz_b' });
        const dc = room.dataChannel('chat');
        const received = [];
        dc.on('message', (data, from) => received.push({ data, from }));

        const aDc = room.peers.peek().get('zzz_b').pc.dataChannelCalls[0];
        // The wrapper attached an onmessage handler in tests (no addEventListener on the stub).
        aDc.onmessage({ data: 'ping' });
        expect(received).toEqual([{ data: 'ping', from: 'zzz_b' }]);
    });
});


describe('Room (peer events update PeerInfo)', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('ontrack flips audio/video flags and adds the track to the stream', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        const pc = room.peers.peek().get('peer_a').pc;
        // Synthesize a remote audio track with no incoming stream to force fallback addTrack().
        pc.fakeTrack({ track: { kind: 'audio', id: 't_audio' }, streams: [] });
        pc.fakeTrack({ track: { kind: 'video', id: 't_video' }, streams: [] });
        const info = room.peers.peek().get('peer_a');
        expect(info.audio).toBe(true);
        expect(info.video).toBe(true);
    });

    it('connectionstatechange propagates onto PeerInfo.connection', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        const pc = room.peers.peek().get('peer_a').pc;
        pc.fakeConnectionStateChange('connected');
        expect(room.peers.peek().get('peer_a').connection).toBe('connected');
    });
});


describe('Room (event bus)', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('peer-joined and peer-left fire the corresponding events', async () => {
        const room = await makeRoom('self_z');
        const joined = [];
        const left   = [];
        room.on('peer-joined', (info) => joined.push(info.id));
        room.on('peer-left',   (info) => left.push(info.id));

        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        fakeSockets[0].fakeMessage({ type: 'peer-left',   id: 'peer_a' });
        expect(joined).toEqual(['peer_a']);
        expect(left).toEqual(['peer_a']);
    });

    it('error fires when a peer\'s connection state goes "failed"', async () => {
        const room = await makeRoom('self_z');
        const errors = [];
        room.on('error', (err) => errors.push(err));

        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        const pc = room.peers.peek().get('peer_a').pc;
        pc.fakeConnectionStateChange('failed');
        expect(errors.length).toBeGreaterThanOrEqual(1);
        expect(errors[0]).toBeInstanceOf(WebRtcError);
        expect(errors[0].code).toBe('ZQ_WEBRTC_PEER_FAILED');
    });

    it('off() removes a previously registered listener', async () => {
        const room = await makeRoom('self_z');
        const seen = [];
        const cb = (info) => seen.push(info.id);
        room.on('peer-joined', cb);
        room.off('peer-joined', cb);
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        expect(seen).toEqual([]);
    });
});


describe('Room (leave)', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('closes every peer, sends a leave frame, and clears state', async () => {
        const room = await makeRoom('self_z');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_b' });
        const pcs = [
            room.peers.peek().get('peer_a').pc,
            room.peers.peek().get('peer_b').pc,
        ];
        await room.leave();
        expect(room.closed).toBe(true);
        expect(room.peers.peek().size).toBe(0);
        for (const pc of pcs) expect(pc.closeCalls).toBe(1);
        const leaves = fakeSockets[0].sentFrames.filter((f) => f.type === 'leave');
        expect(leaves).toHaveLength(1);
    });

    it('is idempotent', async () => {
        const room = await makeRoom('self_z');
        await room.leave();
        await room.leave();
        expect(room.closed).toBe(true);
    });

    it('further peer-joined frames after leave() are ignored', async () => {
        const room = await makeRoom('self_z');
        await room.leave();
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        expect(room.peers.peek().size).toBe(0);
    });
});


describe('webrtc.join()', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('completes the handshake and seeds existing peers from joined.peers', async () => {
        const p = join('ws://localhost/rtc', {
            room: 'room1',
            WebSocket: FakeWebSocket,
            RTCPeerConnection: FakeRTCPeerConnection,
            reconnect: false,
        });
        // Drive the handshake.
        await Promise.resolve();
        fakeSockets[0].fakeOpen();
        fakeSockets[0].fakeMessage({ type: 'hello',  peerId: 'self_z' });
        fakeSockets[0].fakeMessage({ type: 'joined', room: 'room1', peerId: 'self_z', peers: ['peer_a', 'peer_b'] });
        const room = await p;

        expect(room).toBeInstanceOf(Room);
        expect(room.id).toBe('room1');
        expect(room.self).toBe('self_z');
        expect(room.peers.peek().size).toBe(2);
        expect(room.peers.peek().has('peer_a')).toBe(true);
        expect(room.peers.peek().has('peer_b')).toBe(true);
        const joinFrames = fakeSockets[0].sentFrames.filter((f) => f.type === 'join');
        expect(joinFrames).toHaveLength(1);
        expect(joinFrames[0].room).toBe('room1');
    });

    it('rejects when url is missing', async () => {
        await expect(join('', { room: 'r' })).rejects.toThrow(WebRtcError);
    });

    it('rejects when opts.room is missing', async () => {
        await expect(join('ws://x', {})).rejects.toThrow(WebRtcError);
    });

    it('rejects with timeout when hello never arrives', async () => {
        const p = join('ws://localhost/rtc', {
            room: 'room1',
            WebSocket: FakeWebSocket,
            RTCPeerConnection: FakeRTCPeerConnection,
            reconnect: false,
            signalingTimeoutMs: 20,
        });
        await Promise.resolve();
        fakeSockets[0].fakeOpen();
        // Do not deliver `hello`.
        await expect(p).rejects.toThrow(/timed out/i);
    });
});
