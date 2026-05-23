/**
 * tests/webrtc/ice.test.js
 *
 * Coverage for `src/webrtc/ice.js`: parse, stringify (round-trip),
 * address classifiers, and `filterCandidates` policy combinations.
 */

import { describe, it, expect } from 'vitest';
import {
    parseCandidate, stringifyCandidate,
    isPrivateIp, isLoopbackIp, isLinkLocalIp, isMdnsHostname,
    filterCandidates, CANDIDATE_TYPES,
} from '../../src/webrtc/ice.js';
import { IceError } from '../../src/webrtc/errors.js';


describe('ice.parseCandidate', () => {
    const HOST = 'candidate:842163049 1 udp 1677729535 192.168.1.5 50000 typ host';
    const SRFLX = 'candidate:1 1 udp 2122194687 1.2.3.4 50001 typ srflx raddr 192.168.1.5 rport 50000';
    const TCP = 'candidate:2 1 tcp 1518280447 10.0.0.1 9 typ host tcptype active';

    it('parses a simple host candidate', () => {
        const c = parseCandidate(HOST);
        expect(c.foundation).toBe('842163049');
        expect(c.component).toBe(1);
        expect(c.transport).toBe('udp');
        expect(c.priority).toBe(1677729535);
        expect(c.address).toBe('192.168.1.5');
        expect(c.port).toBe(50000);
        expect(c.type).toBe('host');
    });

    it('lifts raddr/rport onto named fields for srflx', () => {
        const c = parseCandidate(SRFLX);
        expect(c.type).toBe('srflx');
        expect(c.relatedAddress).toBe('192.168.1.5');
        expect(c.relatedPort).toBe(50000);
    });

    it('lifts tcptype for TCP candidates', () => {
        const c = parseCandidate(TCP);
        expect(c.transport).toBe('tcp');
        expect(c.tcpType).toBe('active');
    });

    it('accepts the `a=` SDP-attribute prefix', () => {
        const c = parseCandidate(`a=${HOST}`);
        expect(c.address).toBe('192.168.1.5');
    });

    it('captures unknown key/value pairs as extensions', () => {
        const c = parseCandidate(`${HOST} generation 0 ufrag abcd network-id 1`);
        expect(c.extensions.generation).toBe('0');
        expect(c.extensions.ufrag).toBe('abcd');
        expect(c.extensions['network-id']).toBe('1');
    });

    it('throws IceError on non-string input', () => {
        expect(() => parseCandidate(null)).toThrowError(IceError);
        expect(() => parseCandidate(123)).toThrowError(IceError);
    });

    it('throws IceError on missing candidate: prefix', () => {
        expect(() => parseCandidate('842163049 1 udp ...')).toThrowError(IceError);
    });

    it('throws IceError on bad type keyword or unknown type', () => {
        expect(() => parseCandidate('candidate:1 1 udp 1 1.2.3.4 1 nope host')).toThrowError(IceError);
        expect(() => parseCandidate('candidate:1 1 udp 1 1.2.3.4 1 typ moon')).toThrowError(IceError);
    });

    it('throws IceError on out-of-range port', () => {
        expect(() => parseCandidate('candidate:1 1 udp 1 1.2.3.4 99999 typ host')).toThrowError(IceError);
    });
});


describe('ice.stringifyCandidate', () => {
    it('round-trips parseCandidate output exactly', () => {
        const line = 'candidate:1 1 udp 2122194687 1.2.3.4 50001 typ srflx raddr 10.0.0.1 rport 50000 generation 0';
        const reser = stringifyCandidate(parseCandidate(line));
        // generation lands in extensions; order is preserved.
        expect(reser).toBe(line);
    });

    it('throws on missing required fields', () => {
        expect(() => stringifyCandidate({ foundation: '1' })).toThrowError(IceError);
        expect(() => stringifyCandidate(null)).toThrowError(IceError);
    });
});


describe('ice address classifiers', () => {
    it('isPrivateIp covers RFC 1918 / 6598 / ULA', () => {
        expect(isPrivateIp('10.0.0.1')).toBe(true);
        expect(isPrivateIp('172.16.0.1')).toBe(true);
        expect(isPrivateIp('172.32.0.1')).toBe(false);
        expect(isPrivateIp('192.168.1.1')).toBe(true);
        expect(isPrivateIp('100.64.0.1')).toBe(true);
        expect(isPrivateIp('1.2.3.4')).toBe(false);
        expect(isPrivateIp('fc00::1')).toBe(true);
        expect(isPrivateIp('2001:db8::1')).toBe(false);
    });

    it('isLoopbackIp covers 127.0.0.0/8 and ::1', () => {
        expect(isLoopbackIp('127.0.0.1')).toBe(true);
        expect(isLoopbackIp('127.1.2.3')).toBe(true);
        expect(isLoopbackIp('::1')).toBe(true);
        expect(isLoopbackIp('1.2.3.4')).toBe(false);
    });

    it('isLinkLocalIp covers 169.254/16 and fe80::/10', () => {
        expect(isLinkLocalIp('169.254.1.1')).toBe(true);
        expect(isLinkLocalIp('169.255.1.1')).toBe(false);
        expect(isLinkLocalIp('fe80::1')).toBe(true);
        expect(isLinkLocalIp('fec0::1')).toBe(false);
    });

    it('isMdnsHostname is strict about hostnames vs IPs', () => {
        expect(isMdnsHostname('abcd1234.local')).toBe(true);
        expect(isMdnsHostname('Abcd1234.LOCAL')).toBe(true);
        expect(isMdnsHostname('1.2.3.4')).toBe(false);
        expect(isMdnsHostname('fe80::1')).toBe(false);
        expect(isMdnsHostname('example.com')).toBe(false);
        expect(isMdnsHostname(null)).toBe(false);
    });
});


describe('ice.filterCandidates', () => {
    const lines = [
        'candidate:1 1 udp 1 1.2.3.4 5000 typ host',                    // public
        'candidate:2 1 udp 1 10.0.0.1 5000 typ host',                   // private
        'candidate:3 1 udp 1 abc123.local 5000 typ host',               // mDNS
        'candidate:4 1 udp 1 5.6.7.8 5000 typ srflx',                   // srflx public
        'candidate:5 1 tcp 1 5.6.7.8 9 typ host tcptype active',        // TCP
        'candidate:6 1 udp 1 fe80::1 5000 typ host',                    // IPv6 link-local
        'garbage',                                                       // unparseable
    ];

    it('blockMdns drops .local hostnames only', () => {
        const out = filterCandidates(lines, { blockMdns: true });
        expect(out.find((l) => l.includes('.local'))).toBeUndefined();
        expect(out.find((l) => l.includes('1.2.3.4'))).toBeDefined();
    });

    it('blockPrivate drops RFC 1918 addresses', () => {
        const out = filterCandidates(lines, { blockPrivate: true });
        expect(out.find((l) => l.includes('10.0.0.1'))).toBeUndefined();
    });

    it('blockTcp drops TCP transports', () => {
        const out = filterCandidates(lines, { blockTcp: true });
        expect(out.find((l) => l.startsWith('candidate:5 '))).toBeUndefined();
    });

    it('blockLinkLocal drops fe80:: addresses', () => {
        const out = filterCandidates(lines, { blockLinkLocal: true });
        expect(out.find((l) => l.includes('fe80::1'))).toBeUndefined();
    });

    it('allowedTypes whitelist filters out other types', () => {
        const out = filterCandidates(lines, { allowedTypes: ['srflx'] });
        expect(out).toHaveLength(1);
        expect(out[0]).toContain('typ srflx');
    });

    it('maxCandidates caps the result', () => {
        const out = filterCandidates(lines, { maxCandidates: 2 });
        expect(out).toHaveLength(2);
    });

    it('predicate hook can drop individual candidates', () => {
        const out = filterCandidates(lines, { predicate: (c) => c.priority !== 1 || c.address === '1.2.3.4' });
        expect(out.find((l) => l.includes('1.2.3.4'))).toBeDefined();
        expect(out.find((l) => l.includes('10.0.0.1'))).toBeUndefined();
    });

    it('silently skips unparseable lines', () => {
        const out = filterCandidates(lines);
        expect(out.includes('garbage')).toBe(false);
    });

    it('returns parsed objects when input is parsed objects', () => {
        const parsed = lines.slice(0, 4).map(parseCandidate);
        const out = filterCandidates(parsed, { blockMdns: true });
        expect(out.every((c) => typeof c === 'object')).toBe(true);
    });

    it('returns [] when input is not an array', () => {
        expect(filterCandidates(null)).toEqual([]);
        expect(filterCandidates('x')).toEqual([]);
    });
});


describe('ice module constants', () => {
    it('exports CANDIDATE_TYPES frozen', () => {
        expect(CANDIDATE_TYPES).toEqual(['host', 'srflx', 'prflx', 'relay']);
        expect(Object.isFrozen(CANDIDATE_TYPES)).toBe(true);
    });
});
