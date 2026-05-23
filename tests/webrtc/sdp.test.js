/**
 * tests/webrtc/sdp.test.js
 *
 * Coverage for `src/webrtc/sdp.js`: parse extracts the WebRTC-relevant
 * subset, validate enforces the same constraints the server-side hub
 * applies, and both throw `SdpError` with stable codes on bad input.
 */

import { describe, it, expect } from 'vitest';
import { parseSdp, validateSdp, SDP_DIRECTIONS } from '../../src/webrtc/sdp.js';
import { SdpError } from '../../src/webrtc/errors.js';
import { MIN_SDP } from '../_helpers/webrtcFakes.js';


describe('sdp.parseSdp', () => {
    it('parses the canonical minimal SDP fixture', () => {
        const d = parseSdp(MIN_SDP);
        expect(d.version).toBe(0);
        expect(d.media).toHaveLength(1);
        const m = d.media[0];
        expect(m.kind).toBe('audio');
        expect(m.port).toBe(9);
        expect(m.proto).toBe('UDP/TLS/RTP/SAVPF');
        expect(m.fmts).toEqual(['111']);
        expect(m.mid).toBe('0');
        expect(m.iceUfrag).toBe('abcd');
        expect(m.icePwd).toBeDefined();
        expect(m.fingerprint).toBeDefined();
        expect(m.fingerprint.algorithm).toBe('sha-256');
        expect(m.setup).toBe('actpass');
        expect(m.direction).toBe('sendrecv');
        expect(m.rtpmaps).toHaveLength(1);
        expect(m.rtpmaps[0]).toEqual({ payload: 111, codec: 'opus', clockRate: 48000, channels: 2 });
    });

    it('preserves unknown attributes on the raw attribute list', () => {
        const sdp = MIN_SDP + 'a=custom-thing:hello\r\n';
        const d = parseSdp(sdp);
        const a = d.media[0].attributes.find((x) => x.key === 'custom-thing');
        expect(a).toBeDefined();
        expect(a.value).toBe('hello');
    });

    it('extracts a=candidate lines into media.candidates', () => {
        const sdp = MIN_SDP + 'a=candidate:1 1 udp 1 1.2.3.4 5000 typ host\r\n';
        const d = parseSdp(sdp);
        expect(d.media[0].candidates).toHaveLength(1);
        expect(d.media[0].candidates[0]).toBe('candidate:1 1 udp 1 1.2.3.4 5000 typ host');
    });

    it('throws SdpError on non-string input', () => {
        expect(() => parseSdp(null)).toThrowError(SdpError);
        expect(() => parseSdp(42)).toThrowError(SdpError);
    });

    it('throws SdpError on empty input', () => {
        expect(() => parseSdp('')).toThrowError(SdpError);
    });

    it('throws SdpError when payload exceeds maxBytes', () => {
        const huge = 'v=0\r\n' + 'a=x:'.padEnd(10_000, 'y') + '\r\n';
        expect(() => parseSdp(huge, { maxBytes: 100 })).toThrowError(SdpError);
    });

    it('throws SdpError when SDP does not start with v=', () => {
        expect(() => parseSdp('s=foo\r\n')).toThrowError(SdpError);
    });

    it('throws SdpError on malformed line', () => {
        expect(() => parseSdp('v=0\r\nxxx\r\n')).toThrowError(SdpError);
    });

    it('honors LF-only line endings', () => {
        const lf = MIN_SDP.replace(/\r\n/g, '\n');
        const d = parseSdp(lf);
        expect(d.media[0].iceUfrag).toBe('abcd');
    });
});


describe('sdp.validateSdp', () => {
    it('accepts a known-good SDP and returns the parsed structure', () => {
        const d = validateSdp(MIN_SDP);
        expect(d.media[0].iceUfrag).toBe('abcd');
    });

    it('rejects SDP with no m-lines', () => {
        const noMedia = 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n';
        expect(() => validateSdp(noMedia)).toThrowError(SdpError);
    });

    it('rejects SDP with wrong proto on a non-rejected m-line', () => {
        const bad = MIN_SDP.replace('UDP/TLS/RTP/SAVPF', 'RTP/AVP');
        expect(() => validateSdp(bad)).toThrowError(SdpError);
    });

    it('rejects SDP missing ice-ufrag', () => {
        const bad = MIN_SDP.replace(/a=ice-ufrag:abcd\r\n/, '');
        expect(() => validateSdp(bad)).toThrowError(SdpError);
    });

    it('rejects SDP missing ice-pwd', () => {
        const bad = MIN_SDP.replace(/a=ice-pwd:[^\r\n]+\r\n/, '');
        expect(() => validateSdp(bad)).toThrowError(SdpError);
    });

    it('rejects SDP missing fingerprint', () => {
        const bad = MIN_SDP.replace(/a=fingerprint:[^\r\n]+\r\n/, '');
        expect(() => validateSdp(bad)).toThrowError(SdpError);
    });

    it('accepts session-level ice-ufrag/ice-pwd/fingerprint as fallback', () => {
        // Move the m-section attrs up to session level
        const m = MIN_SDP;
        const sessionLevel =
            'v=0\r\n' +
            'o=- 1 1 IN IP4 127.0.0.1\r\n' +
            's=-\r\n' +
            'a=ice-ufrag:abcd\r\n' +
            'a=ice-pwd:0123456789abcdef0123456789abcd\r\n' +
            'a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r\n' +
            't=0 0\r\n' +
            'm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' +
            'a=setup:actpass\r\n' +
            'a=mid:0\r\n' +
            'a=sendrecv\r\n' +
            'a=rtpmap:111 opus/48000/2\r\n';
        // Sanity: it should NOT throw, because session-level attrs are honored.
        const d = validateSdp(sessionLevel);
        expect(d.media[0].iceUfrag).toBeUndefined();    // raw subset: not on m-line
        expect(d.attributes.find((a) => a.key === 'ice-ufrag').value).toBe('abcd');
        // suppress unused-var lint
        expect(m.length).toBeGreaterThan(0);
    });

    it('skips rejected m-lines (port=0)', () => {
        const rejected = MIN_SDP.replace('m=audio 9 ', 'm=audio 0 ').replace(/a=ice-ufrag:[^\r\n]+\r\n/, '');
        // port=0 means rejected and unvalidated, but no other m-line exists so should still fail "no m-lines"?
        // It IS an m-line, just rejected; validator should not throw on it.
        const d = validateSdp(rejected);
        expect(d.media[0].port).toBe(0);
    });
});


describe('sdp module constants', () => {
    it('exports SDP_DIRECTIONS frozen', () => {
        expect(SDP_DIRECTIONS).toEqual(['sendrecv', 'sendonly', 'recvonly', 'inactive']);
        expect(Object.isFrozen(SDP_DIRECTIONS)).toBe(true);
    });
});
