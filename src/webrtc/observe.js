/**
 * src/webrtc/observe.js
 *
 * Low-level WebRTC observability helpers built on top of
 * `RTCPeerConnection.getStats()`. The reactive layer
 * (`useConnectionQuality`) is built on top of these — keeping the raw
 * sampler separate makes it easy to plug stats into logging, dev tools,
 * or telemetry without spinning up the reactive runtime.
 */

import { WebRtcError } from './errors.js';


/**
 * Take a one-shot getStats() snapshot and reduce it to a flat summary
 * suitable for logging, dashboards, or feeding into `classifyStats()`.
 *
 * @param {RTCPeerConnection} pc
 * @returns {Promise<{
 *   report: any,
 *   inboundRtp: any[],
 *   outboundRtp: any[],
 *   candidatePair: any | null,
 *   summary: { rttMs: number | null, lossPct: number, bytesSent: number, bytesReceived: number }
 * }>}
 */
export async function samplePeerStats(pc) {
    if (!pc || typeof pc.getStats !== 'function') {
        throw new WebRtcError('samplePeerStats(pc): RTCPeerConnection required', {
            code: 'ZQ_WEBRTC_OBSERVE_BAD_PC',
        });
    }
    let report;
    try {
        report = await pc.getStats();
    } catch (cause) {
        throw new WebRtcError('samplePeerStats(pc): getStats() failed', {
            code: 'ZQ_WEBRTC_OBSERVE_GETSTATS_FAILED',
            cause,
        });
    }
    return _reduce(report);
}


/**
 * Start a periodic getStats() sampler.
 *
 * @param {RTCPeerConnection} pc
 * @param {{
 *   intervalMs?: number,
 *   onSample?:  (sample: Awaited<ReturnType<typeof samplePeerStats>>) => void,
 *   onError?:   (err: Error) => void,
 *   immediate?: boolean,
 * }} [opts]
 * @returns {{
 *   stop: () => void,
 *   getLatest: () => Awaited<ReturnType<typeof samplePeerStats>> | null,
 * }}
 */
export function createStatsSampler(pc, opts = {}) {
    if (!pc || typeof pc.getStats !== 'function') {
        throw new WebRtcError('createStatsSampler(pc): RTCPeerConnection required', {
            code: 'ZQ_WEBRTC_OBSERVE_BAD_PC',
        });
    }
    const intervalMs = typeof opts.intervalMs === 'number' && opts.intervalMs > 0 ? opts.intervalMs : 2000;
    const immediate  = opts.immediate !== false;
    const onSample   = typeof opts.onSample === 'function' ? opts.onSample : null;
    const onError    = typeof opts.onError  === 'function' ? opts.onError  : null;

    let latest  = null;
    let stopped = false;

    const tick = async () => {
        if (stopped) return;
        try {
            const s = await samplePeerStats(pc);
            if (stopped) return;
            latest = s;
            if (onSample) {
                try { onSample(s); } catch (_) { /* user callback errors are swallowed */ }
            }
        } catch (err) {
            if (onError) {
                try { onError(err); } catch (_) { /* user callback errors are swallowed */ }
            }
        }
    };

    if (immediate) tick();
    const timer = setInterval(tick, intervalMs);

    return {
        stop() {
            if (stopped) return;
            stopped = true;
            clearInterval(timer);
        },
        getLatest() { return latest; },
    };
}


/**
 * Bucket a reduced sample into a coarse quality label.
 *
 * @param {{ summary: { rttMs: number | null, lossPct: number } } | null} sample
 * @returns {'good' | 'fair' | 'poor' | 'unknown'}
 */
export function classifyStats(sample) {
    if (!sample || !sample.summary) return 'unknown';
    const { rttMs, lossPct } = sample.summary;
    if (rttMs == null && lossPct === 0) return 'unknown';
    if (lossPct > 5 || (rttMs != null && rttMs > 400)) return 'poor';
    if (lossPct > 1 || (rttMs != null && rttMs > 200)) return 'fair';
    return 'good';
}


// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function _reduce(report) {
    const inboundRtp  = [];
    const outboundRtp = [];
    let candidatePair = null;

    const visit = (s) => {
        if (!s || typeof s !== 'object') return;
        if (s.type === 'inbound-rtp')  inboundRtp.push(s);
        if (s.type === 'outbound-rtp') outboundRtp.push(s);
        if (s.type === 'candidate-pair' && (s.nominated || s.state === 'succeeded')) {
            if (!candidatePair) candidatePair = s;
        }
    };

    if (report && typeof report.forEach === 'function') {
        report.forEach(visit);
    } else if (report && typeof report === 'object') {
        for (const k of Object.keys(report)) visit(report[k]);
    }

    let bytesSent = 0;
    let bytesReceived = 0;
    let lostTotal = 0;
    let recvTotal = 0;
    for (const s of outboundRtp) {
        if (typeof s.bytesSent === 'number') bytesSent += s.bytesSent;
    }
    for (const s of inboundRtp) {
        if (typeof s.bytesReceived === 'number') bytesReceived += s.bytesReceived;
        if (typeof s.packetsLost     === 'number') lostTotal += s.packetsLost;
        if (typeof s.packetsReceived === 'number') recvTotal += s.packetsReceived;
    }
    const total = lostTotal + recvTotal;
    const lossPct = total > 0 ? (lostTotal / total) * 100 : 0;

    let rttMs = null;
    if (candidatePair && typeof candidatePair.currentRoundTripTime === 'number') {
        rttMs = candidatePair.currentRoundTripTime * 1000;
    }

    return {
        report,
        inboundRtp,
        outboundRtp,
        candidatePair,
        summary: { rttMs, lossPct, bytesSent, bytesReceived },
    };
}
