/**
 * tests/webrtc/joinToken.test.js
 */

import { describe, it, expect } from 'vitest';
import { decodeJoinToken, isJoinTokenExpired } from '../../src/webrtc/index.js';


function b64urlJson(obj) {
    const json = JSON.stringify(obj);
    // base64url-encode in a Node-friendly way
    const b64 = Buffer.from(json, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}


describe('decodeJoinToken', () => {
    it('decodes a JWT-like 3-segment token', () => {
        const header  = b64urlJson({ alg: 'HS256', typ: 'JWT' });
        const payload = b64urlJson({ user: { id: 'u1', name: 'Ada' }, room: 'lobby', exp: 1_700_000_000 });
        const token   = `${header}.${payload}.signature`;
        const d       = decodeJoinToken(token);
        expect(d.user).toEqual({ id: 'u1', name: 'Ada' });
        expect(d.room).toBe('lobby');
        expect(d.exp).toBe(1_700_000_000);
    });

    it('decodes a 2-segment token (payload.sig)', () => {
        const token = `${b64urlJson({ user: { id: 'u2' }, room: 'r' })}.sig`;
        expect(decodeJoinToken(token).user).toEqual({ id: 'u2' });
    });

    it('decodes a 1-segment payload-only token', () => {
        const token = b64urlJson({ user: { id: 'u3' }, room: 'r' });
        expect(decodeJoinToken(token).user.id).toBe('u3');
    });

    it('falls back to `sub` for user id', () => {
        const token = `${b64urlJson({ sub: 'subject-1', room: 'r' })}.sig`;
        expect(decodeJoinToken(token).user).toEqual({ id: 'subject-1' });
    });

    it('returns null user/room/exp when payload lacks them', () => {
        const d = decodeJoinToken(b64urlJson({ foo: 1 }));
        expect(d.user).toBeNull();
        expect(d.room).toBeNull();
        expect(d.exp).toBeNull();
        expect(d.raw).toEqual({ foo: 1 });
    });

    it('rejects empty / non-string input', () => {
        expect(() => decodeJoinToken('')).toThrow(/non-empty string/);
        expect(() => decodeJoinToken(null)).toThrow(/non-empty string/);
    });

    it('rejects malformed shape', () => {
        expect(() => decodeJoinToken('a.b.c.d')).toMatchObject; // throws below
        try { decodeJoinToken('a.b.c.d'); throw new Error('want throw'); }
        catch (err) { expect(err.code).toBe('ZQ_WEBRTC_TOKEN_BAD_SHAPE'); }
    });

    it('rejects bad base64url payload', () => {
        try { decodeJoinToken('not!base64.sig'); throw new Error('want throw'); }
        catch (err) { expect(err.code).toBe('ZQ_WEBRTC_TOKEN_BAD_PAYLOAD'); }
    });
});


describe('isJoinTokenExpired', () => {
    it('returns false when exp is missing', () => {
        expect(isJoinTokenExpired({ exp: null })).toBe(false);
        expect(isJoinTokenExpired({})).toBe(false);
    });

    it('returns true when exp is in the past', () => {
        const expSec = Math.floor(Date.now() / 1000) - 60;
        expect(isJoinTokenExpired({ exp: expSec })).toBe(true);
    });

    it('returns false when exp is in the future', () => {
        const expSec = Math.floor(Date.now() / 1000) + 60;
        expect(isJoinTokenExpired({ exp: expSec })).toBe(false);
    });

    it('respects nowMs override', () => {
        expect(isJoinTokenExpired({ exp: 1000 }, { nowMs: 2_000_000 })).toBe(true);
        expect(isJoinTokenExpired({ exp: 1000 }, { nowMs: 0 })).toBe(false);
    });
});
