import type { EventBus } from "@sportsfacts/event-bus";
import { Topics } from "@sportsfacts/event-bus";
import type { GameEvent } from "@sportsfacts/shared-types";
import type { ReplayState } from "./wsEnvelope.js";

export interface ReplayOptions {
  speed: number;
  /** Cap on real wall-clock delay between two events (ms), so quiet spells don't stall the demo. */
  maxGapMs?: number;
  onState: (state: ReplayState) => void;
  /** Called when the timeline jumps (restart from start or seek) so downstream
   *  running state (e.g. the fact engine, recent buffers) can be cleared. */
  onReset?: () => void;
}

/**
 * Replays normalized events to the event bus paced by their `timelineOffsetMs`,
 * simulating a live feed. Supports speed, pause/resume, and seek.
 */
export class ReplayEngine {
  private readonly state: ReplayState;
  private timer: NodeJS.Timeout | null = null;
  private readonly maxGapMs: number;

  constructor(
    private readonly events: GameEvent[],
    private readonly bus: EventBus,
    private readonly opts: ReplayOptions,
  ) {
    this.maxGapMs = opts.maxGapMs ?? 4000;
    this.state = {
      status: "idle",
      speed: opts.speed,
      cursor: 0,
      total: events.length,
      score: { home: 0, away: 0 },
      clockMinute: 0,
    };
  }

  getState(): ReplayState {
    return { ...this.state, score: { ...this.state.score } };
  }

  start(): void {
    if (this.state.status === "playing") return;
    if (
      this.state.status === "finished" ||
      this.state.cursor >= this.events.length
    ) {
      this.resetCursor();
      this.opts.onReset?.();
    }
    this.state.status = "playing";
    this.emitState();
    this.scheduleNext();
  }

  pause(): void {
    if (this.state.status !== "playing") return;
    this.clearTimer();
    this.state.status = "paused";
    this.emitState();
  }

  setSpeed(speed: number): void {
    this.state.speed = Math.min(Math.max(speed, 0.25), 500);
    this.emitState();
  }

  /** Jump to the first event at or after the given match minute. */
  seek(minute: number): void {
    const idx = this.events.findIndex((e) => e.minute >= minute);
    this.state.cursor = idx === -1 ? this.events.length : idx;
    this.recomputeScoreToCursor();
    // Fact engine state can't be rebuilt mid-stream, so clear it on seek.
    this.opts.onReset?.();
    this.emitState();
    if (this.state.status === "playing") {
      this.clearTimer();
      this.scheduleNext();
    }
  }

  stop(): void {
    this.clearTimer();
  }

  private resetCursor(): void {
    this.state.cursor = 0;
    this.state.score = { home: 0, away: 0 };
    this.state.clockMinute = 0;
  }

  private recomputeScoreToCursor(): void {
    const score = { home: 0, away: 0 };
    for (let i = 0; i < this.state.cursor; i++) {
      const e = this.events[i];
      if (
        e?.type === "goal" &&
        !("shootout" in e.details && e.details.shootout)
      ) {
        score.home = e.details.scoreAfter.home;
        score.away = e.details.scoreAfter.away;
      }
    }
    this.state.score = score;
    this.state.clockMinute = this.events[this.state.cursor - 1]?.minute ?? 0;
  }

  private scheduleNext(): void {
    if (this.state.status !== "playing") return;
    if (this.state.cursor >= this.events.length) {
      this.state.status = "finished";
      this.emitState();
      return;
    }
    const current = this.events[this.state.cursor]!;
    const prevOffset =
      this.state.cursor === 0
        ? current.timelineOffsetMs - 500
        : this.events[this.state.cursor - 1]!.timelineOffsetMs;
    const rawDelay = (current.timelineOffsetMs - prevOffset) / this.state.speed;
    const delay = Math.max(0, Math.min(rawDelay, this.maxGapMs));

    this.timer = setTimeout(() => {
      void this.emitCurrent();
    }, delay);
  }

  private async emitCurrent(): Promise<void> {
    const e = this.events[this.state.cursor];
    if (!e) return;
    if (e.type === "goal" && !("shootout" in e.details && e.details.shootout)) {
      this.state.score = { ...e.details.scoreAfter };
    }
    this.state.clockMinute = e.minute;
    this.state.cursor++;
    await this.bus.publish(Topics.events, e);
    this.emitState();
    this.scheduleNext();
  }

  private emitState(): void {
    this.opts.onState(this.getState());
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
