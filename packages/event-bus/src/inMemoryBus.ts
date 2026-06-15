import { EventEmitter } from "node:events";
import type { EventBus, MessageHandler, Unsubscribe } from "./types.js";

/**
 * In-process EventBus backed by a Node EventEmitter. Used as the default for
 * the single-process demo and for tests. Delivery is asynchronous (next tick)
 * to mirror the semantics of a networked bus.
 */
export class InMemoryEventBus implements EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Replay/dashboard fan-out can attach many listeners to one topic.
    this.emitter.setMaxListeners(0);
  }

  async publish<T>(topic: string, message: T): Promise<void> {
    // Defer so publish() never re-enters a handler synchronously.
    queueMicrotask(() => this.emitter.emit(topic, message));
  }

  async subscribe<T>(
    topic: string,
    handler: MessageHandler<T>,
  ): Promise<Unsubscribe> {
    const listener = (message: T): void => {
      void handler(message);
    };
    this.emitter.on(topic, listener);
    return () => {
      this.emitter.off(topic, listener);
    };
  }

  async close(): Promise<void> {
    this.emitter.removeAllListeners();
  }
}
