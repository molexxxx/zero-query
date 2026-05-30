import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { query, ZQueryCollection } from '../src/core.js';
import { component, mount, prefetch, style } from '../src/component.js';
import { http } from '../src/http.js';
import { deepClone, groupBy, isEmpty } from '../src/utils.js';
import { Room } from '../src/webrtc/room.js';
import { useConnectionQuality, useDataChannel, usePeer, useRoom, useTracks } from '../src/webrtc/reactive.js';
import { WebRtcError } from '../src/webrtc/errors.js';
import { SignalingClient } from '../src/webrtc/signaling.js';
import {
  FakeRTCPeerConnection,
  FakeWebSocket,
  fakeSockets,
  resetFakePeerConnections,
  resetFakeSockets,
} from './_helpers/webrtcFakes.js';

async function openSignaling(selfId = 'self_z') {
  const client = new SignalingClient('ws://localhost/rtc', {
    WebSocket: FakeWebSocket,
    reconnect: false,
  });
  const connectPromise = client.connect();
  fakeSockets[0].fakeOpen();
  fakeSockets[0].fakeMessage({ type: 'hello', peerId: selfId });
  await connectPromise;
  return client;
}

async function makeRoom(selfId = 'self_z') {
  const signaling = await openSignaling(selfId);
  return new Room({
    id: 'room1',
    self: selfId,
    signaling,
    peerOptions: { RTCPeerConnection: FakeRTCPeerConnection },
  });
}

function fakeStream(tracks) {
  return { id: 'stream_fake', getTracks: () => tracks.slice() };
}

function stubAnimationFrame() {
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    callback(performance.now());
    return 1;
  };
  return () => {
    globalThis.requestAnimationFrame = original;
  };
}

function mockHttpResponse({ body = {}, contentType = 'application/json', ok = true, status = 200, jsonThrows = false }) {
  const responseText = typeof body === 'string' ? body : JSON.stringify(body);
  globalThis.fetch = vi.fn(() => Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: {
      get: (header) => header.toLowerCase() === 'content-type' ? contentType : null,
      entries: () => [['content-type', contentType]],
    },
    json: () => jsonThrows ? Promise.reject(new Error('bad json')) : Promise.resolve(typeof body === 'object' ? body : JSON.parse(body)),
    text: () => Promise.resolve(responseText),
    blob: () => Promise.resolve(new Blob([responseText])),
  }));
}

describe('coverage target - utility fallback paths', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('deepClone fallback preserves richer built-ins when structuredClone is unavailable', () => {
    const originalStructuredClone = globalThis.structuredClone;
    Object.defineProperty(globalThis, 'structuredClone', { value: undefined, configurable: true, writable: true });

    try {
      const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;
      const source = {
        date: new Date('2024-01-02T00:00:00.000Z'),
        regex: /zq/gi,
        map: new Map([[{ id: 1 }, { nested: true }]]),
        set: new Set([{ label: 'a' }]),
        typed: new Uint8Array([7, 8]),
        buffer: arrayBuffer,
        nested: { value: 1 },
      };
      source.self = source;

      const clone = deepClone(source);

      expect(clone).not.toBe(source);
      expect(clone.self).toBe(clone);
      expect(clone.date.getTime()).toBe(source.date.getTime());
      expect(clone.regex.source).toBe('zq');
      expect(clone.regex.flags).toBe('gi');
      expect([...clone.map.values()][0]).toEqual({ nested: true });
      expect([...clone.set][0]).toEqual({ label: 'a' });
      expect([...clone.typed]).toEqual([7, 8]);
      expect(clone.buffer).not.toBe(arrayBuffer);
      clone.nested.value = 2;
      expect(source.nested.value).toBe(1);
    } finally {
      Object.defineProperty(globalThis, 'structuredClone', { value: originalStructuredClone, configurable: true, writable: true });
    }
  });

  it('groupBy falls back when Object.groupBy is not present', () => {
    const originalGroupBy = Object.groupBy;
    Object.defineProperty(Object, 'groupBy', { value: undefined, configurable: true, writable: true });

    try {
      expect(groupBy(['ant', 'ape', 'bee'], (item) => item[0])).toEqual({ a: ['ant', 'ape'], b: ['bee'] });
    } finally {
      Object.defineProperty(Object, 'groupBy', { value: originalGroupBy, configurable: true, writable: true });
    }
  });

  it('isEmpty handles maps, sets, primitives, and populated objects', () => {
    expect(isEmpty(new Map())).toBe(true);
    expect(isEmpty(new Set([1]))).toBe(false);
    expect(isEmpty(false)).toBe(false);
    expect(isEmpty({ value: 1 })).toBe(false);
  });
});

describe('coverage target - HTTP edge behavior', () => {
  beforeEach(() => {
    http.clearInterceptors();
    http.configure({ baseURL: '', headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects when a request interceptor blocks the request', async () => {
    http.onRequest(() => false);
    mockHttpResponse({ body: { ok: true } });

    await expect(http.get('https://api.test.com/blocked')).rejects.toThrow('Request blocked by interceptor');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('parses octet-stream responses as blobs', async () => {
    mockHttpResponse({ body: 'binary', contentType: 'application/octet-stream' });

    const result = await http.get('https://api.test.com/file.bin');

    expect(result.data).toBeInstanceOf(Blob);
  });

  it('tries JSON then falls back to text for unknown content types', async () => {
    mockHttpResponse({ body: '{"ok":true}', contentType: 'application/custom+json' });

    const result = await http.get('https://api.test.com/custom');

    expect(result.data).toEqual({ ok: true });
  });

  it('returns null when response body parsing fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockHttpResponse({ body: '{bad', contentType: 'application/json', jsonThrows: true });

    const result = await http.get('https://api.test.com/bad-json');

    expect(result.data).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('uses the AbortSignal.any fallback when native composition is unavailable', async () => {
    const originalAny = AbortSignal.any;
    Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true, writable: true });
    const abortController = new AbortController();
    abortController.abort('stop');
    globalThis.fetch = vi.fn((url, options) => {
      expect(url).toBe('https://api.test.com/abort');
      expect(options.signal.aborted).toBe(true);
      return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });

    try {
      await expect(http.get('https://api.test.com/abort', null, { signal: abortController.signal })).rejects.toThrow('Request aborted');
    } finally {
      Object.defineProperty(AbortSignal, 'any', { value: originalAny, configurable: true, writable: true });
    }
  });

  it('reports timeout aborts distinctly', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    }));

    const requestPromise = http.get('https://api.test.com/slow', null, { timeout: 5 });
    const rejection = expect(requestPromise).rejects.toThrow('Request timeout after 5ms');
    await vi.advanceTimersByTimeAsync(5);

    await rejection;
  });
});

describe('coverage target - collection edge behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="box" style="opacity:1"><span>box</span></div><div id="target"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('animate resolves on transitionend and clears transition style', async () => {
    const restoreAnimationFrame = stubAnimationFrame();

    try {
      const collection = query('#box');
      const animationPromise = collection.animate({ opacity: '0.5' }, 100);
      const box = document.querySelector('#box');
      box.dispatchEvent(new Event('transitionend'));

      await expect(animationPromise).resolves.toBe(collection);
      expect(box.style.transition).toBe('');
      expect(box.style.opacity).toBe('0.5');
    } finally {
      restoreAnimationFrame();
    }
  });

  it('fadeOut hides the element after the animation completes', async () => {
    const restoreAnimationFrame = stubAnimationFrame();

    try {
      const fadePromise = query('#box').fadeOut(100);
      document.querySelector('#box').dispatchEvent(new Event('transitionend'));
      await fadePromise;
      expect(document.querySelector('#box').style.display).toBe('none');
    } finally {
      restoreAnimationFrame();
    }
  });

  it('slideToggle handles visible and hidden elements', () => {
    vi.useFakeTimers();
    const restoreAnimationFrame = stubAnimationFrame();

    try {
      const box = document.querySelector('#box');
      query('#box').slideToggle(25);
      vi.advanceTimersByTime(25);
      expect(box.style.display).toBe('none');

      query('#box').slideToggle(25);
      expect(box.style.overflow).toBe('hidden');
      vi.advanceTimersByTime(25);
      expect(box.style.display).toBe('');
    } finally {
      restoreAnimationFrame();
    }
  });

  it('window scroll helpers read and write through window.scrollTo', () => {
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(window, 'scrollX', { value: 12, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 34, configurable: true });
    const collection = new ZQueryCollection([window]);

    expect(collection.scrollTop()).toBe(34);
    expect(collection.scrollLeft()).toBe(12);

    collection.scrollTop(99);
    collection.scrollLeft(77);

    expect(scrollSpy).toHaveBeenCalledWith(12, 99);
    expect(scrollSpy).toHaveBeenCalledWith(77, 34);
  });
});

describe('coverage target - component external resources and global styles', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    delete window.__zqInline;
  });

  it('prefetches inline template and style resources before mount', async () => {
    window.__zqInline = {
      'external-template.html': '<p class="external">{{ props.label }}</p>',
      'external-style.css': '.external { color: red; }',
    };
    component('coverage-external', {
      props: { label: String },
      templateUrl: 'external-template.html',
      styleUrl: 'external-style.css',
    });
    await prefetch('coverage-external');

    document.body.innerHTML = '<coverage-external id="external" label="Loaded"></coverage-external>';
    mount('#external', 'coverage-external');

    expect(document.querySelector('.external').textContent).toBe('Loaded');
    expect(document.querySelector('style[data-zq-component="coverage-external"]')).not.toBeNull();
  });

  it('style() deduplicates stylesheets and removes critical hiding style after load', async () => {
    const handle = style(['coverage-style.css', 'coverage-style.css'], { bg: '#123456' });
    const links = [...document.querySelectorAll('link[data-zq-style]')].filter((link) => link.href.includes('coverage-style.css'));
    expect(links).toHaveLength(1);
    expect(document.querySelector('style[data-zq-critical]')).not.toBeNull();

    links[0].onload();
    await handle.ready;

    expect(document.querySelector('style[data-zq-critical]')).toBeNull();
    handle.remove();
    expect([...document.querySelectorAll('link[data-zq-style]')].some((link) => link.href.includes('coverage-style.css'))).toBe(false);
  });

  it('style() resolves readiness even when a stylesheet errors', async () => {
    const handle = style('coverage-error.css', { critical: false });
    const link = [...document.querySelectorAll('link[data-zq-style]')].find((candidate) => candidate.href.includes('coverage-error.css'));
    link.onerror();

    await handle.ready;
    handle.remove();

    expect(link.isConnected).toBe(false);
  });
});

describe('coverage target - WebRTC reactive guards', () => {
  beforeEach(() => {
    resetFakeSockets();
    resetFakePeerConnections();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates composable arguments', async () => {
    const room = await makeRoom();

    await expect(useRoom({})).rejects.toThrow(WebRtcError);
    expect(() => usePeer({}, 'peer_a')).toThrow(WebRtcError);
    expect(() => usePeer(room, '')).toThrow(WebRtcError);
    expect(() => useTracks({})).toThrow(WebRtcError);
    expect(() => useDataChannel({}, 'chat')).toThrow(WebRtcError);
    expect(() => useDataChannel(room, '')).toThrow(WebRtcError);
    expect(() => useConnectionQuality({})).toThrow(WebRtcError);
  });

  it('useTracks tolerates streams without events and getTracks failures', () => {
    const handle = useTracks({ stream: { getTracks: () => { throw new Error('track failure'); } } });
    expect(handle.value).toEqual([]);
    handle.refresh();
    expect(handle.value).toEqual([]);
    expect(() => handle.dispose()).not.toThrow();
  });

  it('useDataChannel close and dispose tolerate wrapper failures', async () => {
    const room = await makeRoom();
    const off = vi.fn(() => { throw new Error('off failure'); });
    const wrapper = {
      on: vi.fn(() => off),
      send: vi.fn(),
      close: vi.fn(() => { throw new Error('close failure'); }),
    };
    room.dataChannel = vi.fn(() => wrapper);

    const channel = useDataChannel(room, 'chat');
    channel.send('hello');

    expect(wrapper.send).toHaveBeenCalledWith('hello');
    expect(() => channel.close()).not.toThrow();
    expect(() => channel.dispose()).not.toThrow();
  });

  it('useConnectionQuality accepts object reports and ignores sampler failures', async () => {
    let reportShouldFail = false;
    const handle = useConnectionQuality({ pc: {} }, {
      intervalMs: 999999,
      getStats: async () => {
        if (reportShouldFail) throw new Error('stats unavailable');
        return {
          inbound: { type: 'inbound-rtp', packetsLost: 4, packetsReceived: 96 },
          pair: { type: 'candidate-pair', nominated: true, currentRoundTripTime: 0.25 },
        };
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(handle.value).toBe('fair');

    reportShouldFail = true;
    await handle.dispose();
    expect(handle.value).toBe('fair');
  });
});

describe('coverage target - Room edge behavior', () => {
  beforeEach(() => {
    resetFakeSockets();
    resetFakePeerConnections();
  });

  it('does not add peers after the room is closed', async () => {
    const room = await makeRoom();
    room.closed = true;
    room._addPeer('peer_a');
    expect(room.peers.peek().size).toBe(0);
  });

  it('room event listeners are removable and isolated from listener errors', async () => {
    const room = await makeRoom();
    const joined = [];
    const noop = room.on('peer-joined', null);
    const removeThrower = room.on('peer-joined', () => { throw new Error('listener failure'); });
    room.on('peer-joined', (info) => joined.push(info.id));

    expect(() => noop()).not.toThrow();
    fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
    removeThrower();
    fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_b' });

    expect(joined).toEqual(['peer_a', 'peer_b']);
  });

  it('forwards mute and unmute signaling frames', async () => {
    const room = await makeRoom();
    const events = [];
    room.on('mute', (message) => events.push(['mute', message.kind]));
    room.on('unmute', (message) => events.push(['unmute', message.kind]));

    fakeSockets[0].fakeMessage({ type: 'mute', id: 'peer_a', kind: 'audio' });
    fakeSockets[0].fakeMessage({ type: 'unmute', id: 'peer_a', kind: 'video' });

    expect(events).toEqual([['mute', 'audio'], ['unmute', 'video']]);
  });

  it('track and connection events update PeerInfo and emit failures', async () => {
    const room = await makeRoom();
    const errors = [];
    room.on('error', (error) => errors.push(error));
    fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
    const info = room.peers.peek().get('peer_a');

    info.pc.fakeTrack({ streams: [], track: { kind: 'video', id: 'video_1' } });
    expect(room.peers.peek().get('peer_a').video).toBe(true);
    expect(info.stream.getTracks().some((track) => track.id === 'video_1')).toBe(true);

    const incomingStream = { id: 'incoming', getTracks: () => [] };
    info.pc.fakeTrack({ streams: [incomingStream], track: { kind: 'audio', id: 'audio_1' } });
    expect(room.peers.peek().get('peer_a').stream).toBe(incomingStream);
    expect(room.peers.peek().get('peer_a').audio).toBe(true);

    info.pc.fakeConnectionStateChange('failed');
    expect(errors[0]).toBeInstanceOf(WebRtcError);
  });

  it('publish and unpublish report per-peer sender errors', async () => {
    const room = await makeRoom();
    const errors = [];
    room.on('error', (error) => errors.push(error));
    fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
    const info = room.peers.peek().get('peer_a');

    info.peer.addTrack = () => { throw new Error('add failed'); };
    await room.publish(fakeStream([{ kind: 'audio', id: 'track_fail' }]));
    expect(errors.at(-1).message).toBe('add failed');

    const track = { kind: 'video', id: 'track_remove' };
    const stream = fakeStream([track]);
    info.peer.addTrack = () => ({ track });
    await room.publish(stream);
    info.peer.removeTrack = () => { throw new Error('remove failed'); };
    await room.unpublish(stream);

    expect(errors.at(-1).message).toBe('remove failed');
    await expect(room.unpublish(null)).rejects.toThrow(WebRtcError);
  });

  it('adopts incoming data channels with EventTarget-style listeners', async () => {
    const room = await makeRoom('self_z');
    fakeSockets[0].fakeMessage({ type: 'peer-joined', id: 'peer_a' });
    const wrapper = room.dataChannel('chat');
    const info = room.peers.peek().get('peer_a');
    const opened = [];
    const messages = [];
    const listeners = {};
    const fakeChannel = {
      label: 'chat',
      addEventListener: (event, callback) => { listeners[event] = callback; },
      close: vi.fn(),
      send: vi.fn(() => { throw new Error('dead channel'); }),
    };

    wrapper.on('open', () => { throw new Error('open listener failure'); });
    wrapper.on('open', (peerId) => opened.push(peerId));
    wrapper.on('message', () => { throw new Error('message listener failure'); });
    wrapper.on('message', (data, peerId) => messages.push({ data, peerId }));

    info.pc.fakeDataChannel(fakeChannel);
    listeners.open();
    listeners.message({ data: 'hello' });
    wrapper.send('ignored');
    wrapper.close();

    expect(opened).toEqual(['peer_a']);
    expect(messages).toEqual([{ data: 'hello', peerId: 'peer_a' }]);
    expect(fakeChannel.close).toHaveBeenCalledTimes(1);
    expect(() => wrapper.send('after-close')).not.toThrow();
  });
});