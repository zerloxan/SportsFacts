"use client";

import { useGatewayStream } from "./useGatewayStream";
import type { GameEvent, Fact, MatchMeta, ReplayState } from "./types";

const CATEGORY_COLOR: Record<Fact["category"], string> = {
  milestone: "border-emerald-400/60 bg-emerald-400/10",
  record: "border-amber-400/60 bg-amber-400/10",
  streak: "border-sky-400/60 bg-sky-400/10",
  first: "border-fuchsia-400/60 bg-fuchsia-400/10",
  head_to_head: "border-indigo-400/60 bg-indigo-400/10",
  rarity: "border-rose-400/60 bg-rose-400/10",
  context: "border-slate-400/50 bg-slate-400/10",
};

function eventLabel(e: GameEvent): { icon: string; text: string } {
  const who = e.player?.name ?? e.team.name;
  switch (e.type) {
    case "goal":
      return {
        icon: e.details.shootout ? "🥅" : "⚽",
        text: `${e.details.shootout ? "Shootout: " : "GOAL — "}${who} (${e.team.name})`,
      };
    case "shot":
      return { icon: "🎯", text: `Shot — ${who} (${e.details.outcome})` };
    case "card":
      return {
        icon: e.details.card === "red" ? "🟥" : "🟨",
        text: `${e.details.card} card — ${who}`,
      };
    case "substitution":
      return {
        icon: "🔁",
        text: `Sub (${e.team.name}): ${e.details.playerOn.name} on for ${e.details.playerOff.name}`,
      };
    case "kickoff":
      return { icon: "🟢", text: "Kick-off" };
    case "half_end":
      return { icon: "⏸️", text: "Half ends" };
    default:
      return { icon: "•", text: `${e.type} — ${who}` };
  }
}

function Scoreboard({
  meta,
  state,
}: {
  meta: MatchMeta;
  state: ReplayState | null;
}) {
  const score = state?.score ?? { home: 0, away: 0 };
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-6 shadow-xl">
      <div className="mb-1 text-xs uppercase tracking-widest text-white/50">
        {meta.competition} · {meta.stage}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex-1 text-right text-2xl font-semibold">
          {meta.home.name}
        </span>
        <span className="rounded-lg bg-white/10 px-4 py-2 text-3xl font-bold tabular-nums">
          {score.home} <span className="text-white/40">:</span> {score.away}
        </span>
        <span className="flex-1 text-2xl font-semibold">{meta.away.name}</span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3 text-sm text-white/50">
        <span>⏱ {state?.clockMinute ?? 0}&apos;</span>
        <span>·</span>
        <span className="capitalize">{state?.status ?? "idle"}</span>
        {state?.score &&
          meta.wentToPenalties &&
          state.status === "finished" &&
          meta.shootoutScore && (
            <>
              <span>·</span>
              <span>
                pens {meta.shootoutScore.home}-{meta.shootoutScore.away}
              </span>
            </>
          )}
      </div>
    </div>
  );
}

function Controls({
  state,
  connected,
  control,
}: {
  state: ReplayState | null;
  connected: boolean;
  control: (path: string, body?: unknown) => void;
}) {
  const speeds = [30, 60, 120, 300];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-4">
      <span
        className={`mr-2 inline-flex h-2.5 w-2.5 rounded-full ${
          connected ? "bg-emerald-400" : "bg-rose-500"
        }`}
        title={connected ? "connected" : "disconnected"}
      />
      <button
        className="rounded-lg bg-emerald-500/80 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500"
        onClick={() => control("/api/replay/start")}
      >
        ▶ Play
      </button>
      <button
        className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
        onClick={() => control("/api/replay/pause")}
      >
        ⏸ Pause
      </button>
      <div className="ml-2 flex items-center gap-1">
        <span className="text-xs text-white/50">speed</span>
        {speeds.map((s) => (
          <button
            key={s}
            className={`rounded-md px-2 py-1 text-xs ${
              state?.speed === s
                ? "bg-sky-500 text-white"
                : "bg-white/10 hover:bg-white/20"
            }`}
            onClick={() => control("/api/replay/speed", { speed: s })}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

function FactCard({ fact }: { fact: Fact }) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${CATEGORY_COLOR[fact.category]}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-white/60">
          {fact.category}
        </span>
        <span className="text-[10px] text-white/40">
          {Math.round(fact.confidence * 100)}% · {fact.evidence.source}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug">{fact.text}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-white/50 hover:text-white/80">
          why this is true
        </summary>
        <div className="mt-1 rounded-md bg-black/30 p-2 text-[11px] text-white/70">
          <div className="mb-1 italic">{fact.evidence.description}</div>
          <code className="block break-words text-emerald-300/80">
            {fact.evidence.query}
          </code>
          <code className="mt-1 block break-words text-white/60">
            → {JSON.stringify(fact.evidence.result)}
          </code>
        </div>
      </details>
    </div>
  );
}

export default function Dashboard() {
  const { connected, meta, state, events, facts, control } = useGatewayStream();

  if (!meta) {
    return (
      <main className="mx-auto max-w-6xl p-8">
        <h1 className="text-2xl font-bold">SportsFacts</h1>
        <p className="mt-4 text-white/60">
          {connected ? "Loading match…" : "Connecting to gateway…"}
        </p>
        <p className="mt-2 text-sm text-white/40">
          Start the gateway with <code>pnpm dev</code> (port 8787).
        </p>
      </main>
    );
  }

  const reversedEvents = [...events].reverse();
  const reversedFacts = [...facts].reverse();

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">
          ⚡ SportsFacts <span className="text-white/40">live announcer</span>
        </h1>
        <span className="text-xs text-white/40">{meta.date}</span>
      </header>

      <Scoreboard meta={meta} state={state} />
      <Controls state={state} connected={connected} control={control} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <section className="md:col-span-3">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-white/50">
            AI facts ({facts.length})
          </h2>
          <div className="space-y-3">
            {reversedFacts.length === 0 && (
              <p className="text-sm text-white/40">
                Facts appear here as goals and key moments stream in…
              </p>
            )}
            {reversedFacts.map((f) => (
              <FactCard key={f.id} fact={f} />
            ))}
          </div>
        </section>

        <section className="md:col-span-2">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-white/50">
            Event feed
          </h2>
          <ol className="space-y-1">
            {reversedEvents.map((e) => {
              const { icon, text } = eventLabel(e);
              return (
                <li
                  key={e.id}
                  className="flex items-baseline gap-2 rounded-md bg-white/5 px-3 py-1.5 text-sm"
                >
                  <span className="w-10 shrink-0 tabular-nums text-white/40">
                    {e.minute}&apos;
                  </span>
                  <span>{icon}</span>
                  <span className="text-white/85">{text}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </main>
  );
}
