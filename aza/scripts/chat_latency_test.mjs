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
 * Run from the aza/ dir (it has @stomp/stompjs + ws):
 *
 *   BASE_URL=https://api.aza.systems \
 *   TOKEN_A=<jwt for sender> TOKEN_B=<jwt for recipient> \
 *   OTHER_USER_ID=<B's user id>           # or pass CHAT_ID=<existing chat id> \
 *   COUNT=100 INTERVAL_MS=150 \
 *   node scripts/chat_latency_test.mjs
 *
 * Use throwaway/test accounts — every message is persisted to that chat.
 */
import { Client } from '@stomp/stompjs';
import WebSocket from 'ws';

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

const httpBase = BASE_URL.replace(/\/$/, '');
const wsUrl =
  httpBase.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/websocket';

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
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

function connect(label, token) {
  return new Promise((resolve, reject) => {
    const client = new Client({
      webSocketFactory: () => new WebSocket(wsUrl),
      connectHeaders: { Authorization: `Bearer ${token}` },
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      reconnectDelay: 0,
      onConnect: () => resolve(client),
      onStompError: (f) => reject(new Error(`${label} STOMP error: ${f.headers.message} ${f.body}`)),
      onWebSocketError: (e) => reject(new Error(`${label} WS error: ${e?.message || e}`)),
    });
    client.activate();
  });
}

async function main() {
  CHAT_ID = await resolveChatId();
  console.log(`ws=${wsUrl}\nchat=${CHAT_ID}\ncount=${COUNT} interval=${INTERVAL_MS}ms\n`);

  const [sender, recipient] = await Promise.all([
    connect('A(sender)', TOKEN_A),
    connect('B(recipient)', TOKEN_B),
  ]);
  console.log('both sockets connected\n');

  const sentAt = new Map(); // clientId -> performance.now()
  const latencies = [];
  let received = 0;

  recipient.subscribe('/user/queue/chat', (frame) => {
    let msg;
    try { msg = JSON.parse(frame.body); } catch { return; }
    const cid = msg?.payload?.clientId;
    if (!cid || !sentAt.has(cid)) return;
    latencies.push(performance.now() - sentAt.get(cid));
    sentAt.delete(cid);
    received++;
  });

  // Give the subscription a moment to register on the broker.
  await new Promise((r) => setTimeout(r, 300));

  for (let i = 0; i < COUNT; i++) {
    const clientId = `lt_${Date.now().toString(36)}_${i}`;
    sentAt.set(clientId, performance.now());
    sender.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({
        chatId: CHAT_ID,
        type: 'TEXT',
        clientId,
        ciphertext: `loadtest-${i}`,
        ephemeralKey: 'loadtest',
      }),
    });
    if (INTERVAL_MS > 0) await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  // Drain: wait until everything arrives or the drain window elapses.
  const deadline = Date.now() + DRAIN_MS;
  while (received < COUNT && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }

  await sender.deactivate();
  await recipient.deactivate();

  latencies.sort((a, b) => a - b);
  const mean = latencies.reduce((s, x) => s + x, 0) / (latencies.length || 1);
  const f = (n) => (Number.isNaN(n) ? 'n/a' : `${n.toFixed(1)}ms`);
  console.log('\n=== recipient delivery latency (publish → B receives) ===');
  console.log(`sent       ${COUNT}`);
  console.log(`received   ${received}${received < COUNT ? `  (lost ${COUNT - received})` : ''}`);
  console.log(`min        ${f(latencies[0])}`);
  console.log(`p50        ${f(percentile(latencies, 50))}`);
  console.log(`p95        ${f(percentile(latencies, 95))}`);
  console.log(`p99        ${f(percentile(latencies, 99))}`);
  console.log(`max        ${f(latencies[latencies.length - 1])}`);
  console.log(`mean       ${f(mean)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('load test failed:', e.message);
  process.exit(1);
});
