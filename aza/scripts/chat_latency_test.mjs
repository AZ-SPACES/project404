/**
 * Peer-to-peer chat latency load test.
 *
 * Opens two authenticated STOMP/WebSocket sessions (A = sender, B = recipient),
 * has A publish N messages over /app/chat.send, and times each one from publish
 * to the moment it lands on B's /user/queue/chat. Both ends run on this one
 * machine, so the delta is measured on a single clock — it's the real
 * send → server → recipient delivery latency (A↔server + server compute +
 * server↔B). Reports min / p50 / p95 / p99 / max / mean.
 *
 * The sender's own echo is timed alongside it: the server fans the message out
 * to both participants, and A's copy is what flips the bubble from pending to
 * a "sent" tick. That number is what the person doing the typing actually feels.
 *
 * No dependencies — it speaks STOMP directly over Node's built-in WebSocket
 * (Node 22+), so it runs from a bare checkout without installing the app.
 *
 *   BASE_URL=https://api.aza.systems \
 *   TOKEN_A=<jwt for sender> TOKEN_B=<jwt for recipient> \
 *   OTHER_USER_ID=<B's user id>           # or pass CHAT_ID=<existing chat id> \
 *   COUNT=100 INTERVAL_MS=150 \
 *   node scripts/chat_latency_test.mjs
 *
 * Use throwaway/test accounts — every message is persisted to that chat.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const TOKEN_A = process.env.TOKEN_A;
const TOKEN_B = process.env.TOKEN_B;
const OTHER_USER_ID = process.env.OTHER_USER_ID; // B's user id (to resolve the chat)
let CHAT_ID = process.env.CHAT_ID || '';
const COUNT = Number(process.env.COUNT || 100);
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 150);
const DRAIN_MS = Number(process.env.DRAIN_MS || 10_000); // wait after last send

if (!TOKEN_A || !TOKEN_B) {
  console.error('Set TOKEN_A and TOKEN_B (JWT bearer tokens for two accounts).');
  process.exit(1);
}
if (!CHAT_ID && !OTHER_USER_ID) {
  console.error('Set CHAT_ID, or OTHER_USER_ID (B’s user id) so A can resolve the chat.');
  process.exit(1);
}
if (typeof WebSocket === 'undefined') {
  console.error('No global WebSocket — this script needs Node 22 or newer.');
  process.exit(1);
}

const httpBase = BASE_URL.replace(/\/$/, '');
const wsUrl =
  httpBase.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/websocket';

const NUL = '\u0000';
const COMMANDS = ['CONNECTED', 'MESSAGE', 'RECEIPT', 'ERROR'];

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

/**
 * Minimal STOMP 1.2 client — CONNECT, SUBSCRIBE, SEND and inbound MESSAGE are
 * all this test needs, and hand-rolling them keeps the script dependency-free.
 */
class Stomp {
  constructor(label, url) {
    this.label = label;
    this.url = url;
    this.subs = new Map(); // subscription id -> handler
    this.nextSubId = 0;
    this.buffer = '';
  }

  connect(token) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const fail = (msg) => reject(new Error(`${this.label}: ${msg}`));

      ws.onopen = () => {
        this.send('CONNECT', {
          'accept-version': '1.2',
          host: new URL(this.url).host,
          // Keep the socket alive without letting a missed beat fail the run;
          // the test is short and we only care about message timing.
          'heart-beat': '0,10000',
          Authorization: `Bearer ${token}`,
        });
      };
      ws.onerror = () => fail('WebSocket error (is BASE_URL reachable?)');
      ws.onclose = (e) => fail(`socket closed before CONNECTED (code ${e.code})`);
      ws.onmessage = (e) => {
        for (const frame of this.parse(String(e.data))) {
          if (frame.command === 'CONNECTED') {
            // Past the handshake, a close is only fatal mid-run.
            ws.onclose = null;
            ws.onerror = null;
            resolve(this);
          } else if (frame.command === 'ERROR') {
            fail(`STOMP ERROR ${frame.headers.message || ''} ${frame.body}`.trim());
          } else if (frame.command === 'MESSAGE') {
            const handler = this.subs.get(frame.headers.subscription);
            if (handler) handler(frame);
          }
        }
      };
    });
  }

  /**
   * Split a WS payload into frames. A lone newline is a heartbeat, not a frame.
   * Frames normally end at a NUL, but Spring's endpoint can leave it off — the
   * app sets stompjs's appendMissingNULLonIncoming for the same reason — so an
   * unterminated but complete frame is recovered via its content-length.
   */
  parse(chunk) {
    this.buffer += chunk;
    const frames = [];

    for (;;) {
      this.buffer = this.buffer.replace(/^\n+/, ''); // drop heartbeats
      if (!this.buffer) break;

      const nul = this.buffer.indexOf(NUL);
      let text;
      if (nul !== -1) {
        text = this.buffer.slice(0, nul);
        this.buffer = this.buffer.slice(nul + 1);
      } else {
        // No terminator yet. Only usable if the headers are complete and a
        // content-length tells us the body has fully arrived.
        const split = this.buffer.indexOf('\n\n');
        if (split === -1) break;
        const head = this.buffer.slice(0, split);
        if (!COMMANDS.includes(head.split('\n')[0])) break;
        const len = /(?:^|\n)content-length:(\d+)/.exec(head);
        if (!len) break;
        const body = this.buffer.slice(split + 2);
        if (Buffer.byteLength(body) < Number(len[1])) break;
        text = this.buffer;
        this.buffer = '';
      }

      const split = text.indexOf('\n\n');
      const head = split === -1 ? text : text.slice(0, split);
      const body = split === -1 ? '' : text.slice(split + 2);
      const lines = head.split('\n');
      const headers = {};
      for (const line of lines.slice(1)) {
        const c = line.indexOf(':');
        if (c > 0 && !(line.slice(0, c) in headers)) headers[line.slice(0, c)] = line.slice(c + 1);
      }
      frames.push({ command: lines[0], headers, body });
    }
    return frames;
  }

  send(command, headers = {}, body = '') {
    const head = Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n');
    this.ws.send(`${command}\n${head}\n\n${body}${NUL}`);
  }

  subscribe(destination, handler) {
    const id = `sub-${this.nextSubId++}`;
    this.subs.set(id, handler);
    this.send('SUBSCRIBE', { id, destination });
  }

  publish(destination, body) {
    this.send('SEND', {
      destination,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    }, body);
  }

  close() {
    try { this.ws.close(); } catch { /* already gone */ }
  }
}

async function resolveChatId() {
  if (CHAT_ID) return CHAT_ID;
  const res = await fetch(`${httpBase}/api/v1/chats/${OTHER_USER_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_A}` },
  });
  if (!res.ok) throw new Error(`resolve chat failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  const id = body?.data?.id ?? body?.id;
  if (!id) throw new Error('resolve chat: no id in response');
  return id;
}

/** Record the publish→arrival delta for a frame carrying one of our clientIds. */
function timerFor(sentAt, out) {
  return (frame) => {
    let msg;
    try { msg = JSON.parse(frame.body); } catch { return; }
    const cid = msg?.payload?.clientId;
    if (!cid) return;
    const t0 = sentAt.get(cid);
    if (t0 === undefined) return;
    out.push(performance.now() - t0);
  };
}

function report(title, latencies, sent) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const mean = sorted.reduce((s, x) => s + x, 0) / (sorted.length || 1);
  const f = (n) => (n === undefined || Number.isNaN(n) ? 'n/a' : `${n.toFixed(1)}ms`);
  console.log(`\n=== ${title} ===`);
  console.log(`sent       ${sent}`);
  console.log(`received   ${sorted.length}${sorted.length < sent ? `  (lost ${sent - sorted.length})` : ''}`);
  console.log(`min        ${f(sorted[0])}`);
  console.log(`p50        ${f(percentile(sorted, 50))}`);
  console.log(`p95        ${f(percentile(sorted, 95))}`);
  console.log(`p99        ${f(percentile(sorted, 99))}`);
  console.log(`max        ${f(sorted[sorted.length - 1])}`);
  console.log(`mean       ${f(mean)}`);
}

async function main() {
  CHAT_ID = await resolveChatId();
  console.log(`ws=${wsUrl}\nchat=${CHAT_ID}\ncount=${COUNT} interval=${INTERVAL_MS}ms\n`);

  const [sender, recipient] = await Promise.all([
    new Stomp('A(sender)', wsUrl).connect(TOKEN_A),
    new Stomp('B(recipient)', wsUrl).connect(TOKEN_B),
  ]);
  console.log('both sockets connected\n');

  const sentAt = new Map(); // clientId -> performance.now()
  const delivery = []; // publish → B receives
  const echo = []; // publish → A receives its own copy (the "sent" tick)

  recipient.subscribe('/user/queue/chat', timerFor(sentAt, delivery));
  sender.subscribe('/user/queue/chat', timerFor(sentAt, echo));

  // Give the subscriptions a moment to register on the broker.
  await new Promise((r) => setTimeout(r, 300));

  for (let i = 0; i < COUNT; i++) {
    const clientId = `lt_${Date.now().toString(36)}_${i}`;
    sentAt.set(clientId, performance.now());
    sender.publish('/app/chat.send', JSON.stringify({
      chatId: CHAT_ID,
      type: 'TEXT',
      clientId,
      ciphertext: `loadtest-${i}`,
      ephemeralKey: 'loadtest',
    }));
    if (INTERVAL_MS > 0) await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  // Drain: wait until everything arrives or the drain window elapses.
  const deadline = Date.now() + DRAIN_MS;
  while (delivery.length < COUNT && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }

  sender.close();
  recipient.close();

  report('recipient delivery latency (publish → B receives)', delivery, COUNT);
  report('sender echo latency (publish → A sees its own "sent")', echo, COUNT);
  process.exit(0);
}

main().catch((e) => {
  console.error('load test failed:', e.message);
  process.exit(1);
});
