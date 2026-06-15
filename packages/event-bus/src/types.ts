/** Handler invoked for each message delivered on a subscribed topic. */
export type MessageHandler<T> = (message: T) => void | Promise<void>;

/** Unsubscribe function returned by {@link EventBus.subscribe}. */
export type Unsubscribe = () => void | Promise<void>;

/**
 * Minimal publish/subscribe abstraction. Implementations may be in-process
 * (development/tests) or distributed (Redis Streams). Consumers depend only on
 * this interface so the backend is a configuration choice.
 */
export interface EventBus {
  /** Publish a JSON-serializable message to a named topic. */
  publish<T>(topic: string, message: T): Promise<void>;
  /** Subscribe to a topic; returns a function to stop receiving messages. */
  subscribe<T>(topic: string, handler: MessageHandler<T>): Promise<Unsubscribe>;
  /** Release any underlying resources (connections, timers). */
  close(): Promise<void>;
}
