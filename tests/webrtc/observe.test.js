/**
 * tests/webrtc/observe.test.js
 */

import { describe, it, expect, vi } from 'vitest';
import { samplePeerStats, createStatsSampler, classifyStats } from '../../src/webrtc/index.js';


function makeReport(entries) {
    const map = new Map();
    for (const e of entries) map.set(e.id || e.type, e);
    return map;
}

function makePc(report) {
    return { getStats: vi.fn(async () => report) };
}


describe('samplePeerStats', () => {
    it('reduces an iterable getStats report to a flat summary', async () => {
        const pc = makePc(makeReport([
            { id: 'in1',  type: 'inbound-rtp',    bytesReceived: 1000, packetsReceived: 100, packetsLost: 2 },
            { id: 'out1', type: 'outbound-rtp',   bytesSent: 5000 },
            { id: 'cp1',  type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0.05 },
        ]));
        const s = await samplePeerStats(pc);
        expect(s.inboundRtp.length).toBe(1);
        expect(s.outboundRtp.length).toBe(1);
        expect(s.candidatePair).not.toBeNull();
        expect(s.summary.bytesSent).toBe(5000);
        expect(s.summary.bytesReceived).toBe(1000);
        expect(s.summary.rttMs).toBeCloseTo(50);
        expect(s.summary.lossPct).toBeCloseTo((2 / 102) * 100);
    });

    it('handles a plain-object report', async () => {
        const pc = makePc({
            in1:  { type: 'inbound-rtp',  bytesReceived: 10, packetsReceived: 1, packetsLost: 0 },
            out1: { type: 'outbound-rtp', bytesSent: 20 },
        });
        const s = await samplePeerStats(pc);
        expect(s.summary.bytesSent).toBe(20);
        expect(s.summary.bytesReceived).toBe(10);
        expect(s.candidatePair).toBeNull();
    });

    it('rejects a non-RTCPeerConnection', async () => {
        await expect(samplePeerStats({})).rejects.toMatchObject({ code: 'ZQ_WEBRTC_OBSERVE_BAD_PC' });
    });

    it('wraps getStats() failures', async () => {
        const pc = { getStats: async () => { throw new Error('boom'); } };
        await expect(samplePeerStats(pc)).rejects.toMatchObject({ code: 'ZQ_WEBRTC_OBSERVE_GETSTATS_FAILED' });
    });
});


describe('classifyStats', () => {
    it('returns "unknown" for empty samples', () => {
        expect(classifyStats(null)).toBe('unknown');
        expect(classifyStats({ summary: { rttMs: null, lossPct: 0 } })).toBe('unknown');
    });

    it('returns "good" for low rtt/loss', () => {
        expect(classifyStats({ summary: { rttMs: 50, lossPct: 0.2 } })).toBe('good');
    });

    it('returns "fair" for moderate rtt/loss', () => {
        expect(classifyStats({ summary: { rttMs: 250, lossPct: 0.5 } })).toBe('fair');
        expect(classifyStats({ summary: { rttMs: 50,  lossPct: 2   } })).toBe('fair');
    });

    it('returns "poor" for high rtt/loss', () => {
        expect(classifyStats({ summary: { rttMs: 500, lossPct: 0 } })).toBe('poor');
        expect(classifyStats({ summary: { rttMs: 50,  lossPct: 10 } })).toBe('poor');
    });
});


describe('createStatsSampler', () => {
    it('samples immediately and reports via onSample', async () => {
        const pc = makePc(makeReport([
            { id: 'in1', type: 'inbound-rtp', bytesReceived: 1, packetsReceived: 1, packetsLost: 0 },
        ]));
        const samples = [];
        const sampler = createStatsSampler(pc, {
            intervalMs: 10_000,
            onSample: (s) => samples.push(s),
        });
        // Yield so the immediate getStats() resolves.
        await new Promise((r) => setTimeout(r, 5));
        sampler.stop();
        expect(samples.length).toBe(1);
        expect(sampler.getLatest()).toBe(samples[0]);
    });

    it('forwards getStats() failures to onError', async () => {
        const pc = { getStats: async () => { throw new Error('nope'); } };
        const errs = [];
        const sampler = createStatsSampler(pc, { intervalMs: 10_000, onError: (e) => errs.push(e) });
        await new Promise((r) => setTimeout(r, 5));
        sampler.stop();
        expect(errs.length).toBe(1);
        expect(errs[0].code).toBe('ZQ_WEBRTC_OBSERVE_GETSTATS_FAILED');
    });

    it('rejects a non-RTCPeerConnection', () => {
        expect(() => createStatsSampler({})).toThrow(/RTCPeerConnection required/);
    });
});
