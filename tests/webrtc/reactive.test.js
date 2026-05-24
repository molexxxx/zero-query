/**
 * tests/webrtc/reactive.test.js
 *
 * Coverage for the WebRTC composables:
 *   - useRoom() wraps an existing Room instance synchronously
 *   - useRoom() joins via signaling and resolves to a Room
 *   - usePeer() reflects the live PeerInfo and updates on peer-joined / peer-left
 *   - useTracks() snapshots current tracks and exposes refresh()
 *   - useDataChannel() buffers inbound frames into `messages.value`
 *   - useConnectionQuality() classifies stats reports into good/fair/poor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Room, join as joinRoom } from '../../src/webrtc/room.js';
import { useRoom, usePeer, useTracks, useDataChannel, useConnectionQuality } from '../../src/webrtc/reactive.js';
import { SignalingClient } from '../../src/webrtc/signaling.js';
import {
    FakeWebSocket, fakeSockets, resetFakeSockets,
    FakeRTCPeerConnection, fakePeerConnections, resetFakePeerConnections,
} from '../_helpers/webrtcFakes.js';


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

async function makeRoom(selfId = 'self_z') {
    const sig = await openSignaling(selfId);
    return new Room({
        id: 'room1',
        self: selfId,
        signaling: sig,
        peerOptions: { RTCPeerConnection: FakeRTCPeerConnection },
    });
}


describe('useRoom()', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('returns a Promise that resolves to a passed-in Room', async () => {
        const room = await makeRoom();
        const handle = await useRoom(room);
        expect(handle).toBe(room);
    });

    it('joins via signaling when given a URL', async () => {
        const p = useRoom('ws://localhost/rtc', {
            room: 'r1',
            WebSocket: FakeWebSocket,
            RTCPeerConnection: FakeRTCPeerConnection,
            reconnect: false,
        });
        await Promise.resolve();
        fakeSockets[0].fakeOpen();
        fakeSockets[0].fakeMessage({ type: 'hello',  peerId: 'self_z' });
        fakeSockets[0].fakeMessage({ type: 'joined', room: 'r1', peerId: 'self_z', peers: [] });
        const room = await p;
        expect(room).toBeInstanceOf(Room);
    });
});


describe('usePeer()', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('returns null when the peer is absent', async () => {
        const room = await makeRoom();
        const handle = usePeer(room, 'peer_a');
        expect(handle.value).toBeNull();
        handle.dispose();
    });

    it('reflects the PeerInfo when the peer joins, and null again on leave', async () => {
        const room = await makeRoom();
        const handle = usePeer(room, 'peer_a');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        expect(handle.value).not.toBeNull();
        expect(handle.value.id).toBe('peer_a');
        fakeSockets[0].fakeMessage({ type: 'peer-left', id: 'peer_a' });
        expect(handle.value).toBeNull();
        handle.dispose();
    });

    it('subscribe() fires on peer mutations', async () => {
        const room = await makeRoom();
        const handle = usePeer(room, 'peer_a');
        let n = 0;
        const off = handle.subscribe(() => { n++; });
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
        fakeSockets[0].fakeMessage({ type: 'peer-left',   id: 'peer_a' });
        expect(n).toBeGreaterThanOrEqual(2);
        off();
        handle.dispose();
    });
});


describe('useTracks()', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('returns the current tracks from the PeerInfo stream', async () => {
        const tracks = [{ kind: 'audio', id: 'a' }];
        const stream = { getTracks: () => tracks.slice() };
        const handle = useTracks({ stream });
        expect(handle.value).toEqual(tracks);
        handle.dispose();
    });

    it('refresh() re-samples the underlying stream', async () => {
        const tracks = [{ kind: 'audio', id: 'a' }];
        const stream = { getTracks: () => tracks.slice() };
        const handle = useTracks({ stream });
        expect(handle.value).toHaveLength(1);
        tracks.push({ kind: 'video', id: 'v' });
        handle.refresh();
        expect(handle.value).toHaveLength(2);
        handle.dispose();
    });

    it('listens to addtrack/removetrack when the stream is an EventTarget', async () => {
        const listeners = {};
        const stream = {
            getTracks: () => [],
            addEventListener: (ev, cb) => { listeners[ev] = cb; },
            removeEventListener: (ev) => { delete listeners[ev]; },
        };
        const handle = useTracks({ stream });
        expect(typeof listeners.addtrack).toBe('function');
        expect(typeof listeners.removetrack).toBe('function');
        handle.dispose();
        expect(listeners.addtrack).toBeUndefined();
    });
});


describe('useDataChannel()', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    it('buffers inbound messages into messages.value', async () => {
        const room = await makeRoom('aaa_self');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'zzz_a' });
        const dc = useDataChannel(room, 'chat');
        const aDc = room.peers.peek().get('zzz_a').pc.dataChannelCalls[0];
        aDc.onmessage({ data: 'hi' });
        aDc.onmessage({ data: 'there' });
        expect(dc.messages.value.map((m) => m.data)).toEqual(['hi', 'there']);
        expect(dc.messages.value[0].from).toBe('zzz_a');
        dc.close();
    });

    it('history option caps the buffer length', async () => {
        const room = await makeRoom('aaa_self');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'zzz_a' });
        const dc = useDataChannel(room, 'chat', { history: 2 });
        const aDc = room.peers.peek().get('zzz_a').pc.dataChannelCalls[0];
        aDc.onmessage({ data: '1' });
        aDc.onmessage({ data: '2' });
        aDc.onmessage({ data: '3' });
        expect(dc.messages.value.map((m) => m.data)).toEqual(['2', '3']);
        dc.close();
    });

    it('send() forwards to the room wrapper', async () => {
        const room = await makeRoom('aaa_self');
        fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'zzz_a' });
        const dc = useDataChannel(room, 'chat');
        const aDc = room.peers.peek().get('zzz_a').pc.dataChannelCalls[0];
        const sends = [];
        aDc.send = (d) => sends.push(d);
        dc.send('go');
        expect(sends).toEqual(['go']);
        dc.close();
    });
});


describe('useConnectionQuality()', () => {
    beforeEach(() => { resetFakeSockets(); resetFakePeerConnections(); });

    function buildReport({ lossPct = 0, rttMs = 0 }) {
        const inbound = { type: 'inbound-rtp', packetsLost: 0, packetsReceived: 100 };
        if (lossPct > 0) {
            inbound.packetsLost     = lossPct;
            inbound.packetsReceived = 100 - lossPct;
        }
        const pair = { type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: rttMs / 1000 };
        return new Map([['a', inbound], ['b', pair]]);
    }

    it('classifies a clean report as good', async () => {
        const peerInfo = { pc: {} };
        const handle = useConnectionQuality(peerInfo, {
            intervalMs: 999_999,
            getStats: async () => buildReport({ lossPct: 0, rttMs: 50 }),
        });
        await new Promise((r) => setTimeout(r, 10));
        expect(handle.value).toBe('good');
        handle.dispose();
    });

    it('classifies a lossy report as fair', async () => {
        const peerInfo = { pc: {} };
        const handle = useConnectionQuality(peerInfo, {
            intervalMs: 999_999,
            getStats: async () => buildReport({ lossPct: 5, rttMs: 250 }),
        });
        await new Promise((r) => setTimeout(r, 10));
        expect(handle.value).toBe('fair');
        handle.dispose();
    });

    it('classifies a very lossy report as poor', async () => {
        const peerInfo = { pc: {} };
        const handle = useConnectionQuality(peerInfo, {
            intervalMs: 999_999,
            getStats: async () => buildReport({ lossPct: 25, rttMs: 600 }),
        });
        await new Promise((r) => setTimeout(r, 10));
        expect(handle.value).toBe('poor');
        handle.dispose();
    });
});


// Suppress unused-import warning - joinRoom is a re-export for callers.
void joinRoom;
