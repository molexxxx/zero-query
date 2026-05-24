// server/index.js - WebRTC signaling + TURN backend
//
// Hosts the zQuery webrtc demo over real WebSocket signaling using
// @zero-server/webrtc's SignalingHub. Browsers connect with
// `$.webrtc.join('ws://host:PORT/rtc', { room })` and exchange offers /
// answers / ICE through the hub - so two real machines (not just two
// tabs in the same browser) can call each other.
//
// Usage:
//   node server/index.js          # listens on PORT (default 3000)
//   PORT=8080 node server/index.js
//
// Optional environment variables:
//   WEBRTC_JWT_SECRET   - if set, joins must include a signed join token.
//                         GET /rtc/token/:room returns a short-TTL token.
//   TURN_SECRET         - if set, GET /rtc/turn returns ephemeral
//                         RFC 7635 TURN credentials. Otherwise it returns
//                         a plain STUN-only iceServers list.
//   TURN_URLS           - comma-separated TURN/STUN URLs to hand out
//                         (e.g. 'turn:turn.example.com:3478?transport=udp').
//
// @zero-server/sdk and @zero-server/webrtc are devDependencies declared in
// package.json. If they aren't installed yet, this script prompts to
// install them once on first run (same pattern as the dev server does
// for zero-http).

'use strict';

const path = require('node:path');

// ---------------------------------------------------------------------------
// Install prompt
// ---------------------------------------------------------------------------

/**
 * Prompt the user to install a missing devDependency. Resolves true on yes.
 */
function promptInstall(label) {
    const rl = require('node:readline').createInterface({
        input:  process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(
            '\n  This server needs ' + label + ', which is not installed.\n' +
            '  These packages are only used by the demo server and are not\n' +
            '  required for the client bundle, building, or production.\n' +
            '  Install them now? (y/n): ',
            (answer) => {
                rl.close();
                resolve(answer.trim().toLowerCase() === 'y');
            }
        );
    });
}

/**
 * `require` a package; on failure, prompt the user to npm-install it as a
 * devDependency, then re-require. Exits the process if the user declines.
 */
async function requireOrInstall(pkgs) {
    try {
        return pkgs.map((p) => require(p));
    } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') throw err;
        const ok = await promptInstall(pkgs.join(' + '));
        if (!ok) {
            console.error('\n  ✖ Cannot start the WebRTC server without these packages.\n');
            process.exit(1);
        }
        const { execSync } = require('node:child_process');
        const args = pkgs.join(' ');
        console.log('\n  Installing ' + args + '...\n');
        execSync('npm install --save-dev ' + args, { stdio: 'inherit' });
        return pkgs.map((p) => require(p));
    }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main() {
    const [sdk, webrtc] = await requireOrInstall([
        '@zero-server/sdk',
        '@zero-server/webrtc',
    ]);

    const {
        createApp,
        helmet,
        cors,
        compress,
        static: serveStatic,
    } = sdk;
    const {
        SignalingHub,
        signJoinToken,
        issueTurnCredentials,
    } = webrtc;

    const PORT     = parseInt(process.env.PORT || '3000', 10);
    const ROOT     = path.resolve(__dirname, '..');
    const JWT      = process.env.WEBRTC_JWT_SECRET || null;
    const TURN_SEC = process.env.TURN_SECRET || null;
    const TURN_URLS = (process.env.TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const STUN_FALLBACK = ['stun:stun.l.google.com:19302'];

    const app = createApp();

    // ---- Security & static assets ----
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc:  ["'self'", "'unsafe-inline'"],
                styleSrc:   ["'self'", "'unsafe-inline'"],
                imgSrc:     ["'self'", 'data:', 'blob:'],
                mediaSrc:   ["'self'", 'blob:'],
                connectSrc: ["'self'", 'ws:', 'wss:'],
                fontSrc:    ["'self'", 'data:'],
            },
        },
        hsts: false,
    }));
    app.use(cors());
    app.use(compress({ threshold: 1024 }));
    app.use(serveStatic(ROOT, { index: 'index.html' }));

    // ---- Signaling hub ----
    const hubOpts = {};
    if (JWT) hubOpts.joinTokenSecret = JWT;
    const hub = new SignalingHub(hubOpts);

    app.ws('/rtc', (ws, req) => {
        hub.attach(ws, {
            ip:     req.ip,
            origin: req.headers && req.headers.origin,
        });
    });

    hub.on('join',  ({ peer, room }) => console.log('  + peer', peer.id, 'joined', room.name));
    hub.on('leave', ({ peer, room }) => console.log('  - peer', peer.id, 'left',   room.name));

    // ---- Join token endpoint (only when WEBRTC_JWT_SECRET is set) ----
    app.get('/rtc/token/:room', (req, res) => {
        if (!JWT) return res.json({ wsUrl: _wsUrl(req), token: null });
        const token = signJoinToken({
            secret: JWT,
            user:   { id: 'anon-' + Math.random().toString(36).slice(2, 10) },
            room:   req.params.room,
            ttl:    300,
        });
        res.json({ wsUrl: _wsUrl(req), token });
    });

    // ---- TURN/STUN credential endpoint ----
    app.get('/rtc/turn', (req, res) => {
        if (TURN_SEC && TURN_URLS.length) {
            const creds = issueTurnCredentials({
                secret:  TURN_SEC,
                userId:  'anon-' + Math.random().toString(36).slice(2, 10),
                ttl:     '20m',
                servers: TURN_URLS,
            });
            return res.json({ iceServers: [creds] });
        }
        // Dev fallback - public STUN only. Works for two machines on the
        // same network but cannot traverse symmetric NATs without TURN.
        const urls = TURN_URLS.length ? TURN_URLS : STUN_FALLBACK;
        res.json({ iceServers: [{ urls }] });
    });

    // ---- Rooms directory ----
    // Lists every room the hub currently knows about so the lobby UI can
    // offer a one-click join instead of forcing users to remember a name.
    app.get('/rtc/rooms', (req, res) => {
        const rooms = hub.rooms().map((r) => ({
            name:      r.name,
            peerCount: (typeof r.peers === 'function' ? r.peers() : []).length,
        }));
        res.json({ rooms });
    });

    // ---- Listen ----
    app.listen(PORT, () => {
        console.log('\n  ⚡ WebRTC server → http://localhost:' + PORT);
        console.log('     • signaling   ws://localhost:'   + PORT + '/rtc');
        console.log('     • turn creds  http://localhost:' + PORT + '/rtc/turn');
        if (JWT) {
            console.log('     • join tokens http://localhost:' + PORT + '/rtc/token/<room>');
        } else {
            console.log('     • join tokens disabled (set WEBRTC_JWT_SECRET to enable)');
        }
        console.log('');
    });
}

function _wsUrl(req) {
    const host = (req.headers && req.headers.host) || 'localhost:3000';
    const proto = (req.headers && req.headers['x-forwarded-proto'] === 'https') ? 'wss' : 'ws';
    return proto + '://' + host + '/rtc';
}

main().catch((err) => {
    console.error('\n  ✖ WebRTC server failed to start:\n');
    console.error(err);
    process.exit(1);
});
