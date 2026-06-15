// Quick end-to-end smoke test: connect to the gateway WS, collect messages
// while the match replays, and print a summary. Run after starting the gateway.
import WebSocket from "ws";

const url = process.env.WS_URL ?? "ws://localhost:8787/ws";
const ws = new WebSocket(url);
const counts = { snapshot: 0, event: 0, fact: 0, state: 0 };
const facts = [];
let lastState = null;

ws.on("open", () => console.log(`connected ${url}`));
ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  counts[msg.kind] = (counts[msg.kind] ?? 0) + 1;
  if (msg.kind === "fact") facts.push(msg.data);
  if (msg.kind === "state") lastState = msg.data;
});

const runMs = Number(process.env.RUN_MS ?? 9000);
setTimeout(() => {
  console.log("\n=== message counts ===");
  console.log(counts);
  console.log("\n=== final state ===");
  console.log(lastState);
  console.log(`\n=== facts (${facts.length}) ===`);
  for (const f of facts) {
    console.log(`• [${f.category}] ${f.text}`);
    console.log(`    evidence(${f.evidence.source}): ${JSON.stringify(f.evidence.result)}`);
  }
  ws.close();
  process.exit(0);
}, runMs);
