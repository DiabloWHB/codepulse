type EventCallback<T = unknown> = (data: T) => void;

/**
 * Simple typed event bus for decoupled communication.
 */
export class EventBus {
  private readonly listeners = new Map<string, Set<EventCallback>>();

  /**
   * Subscribe to an event.
   * Returns unsubscribe function.
   */
  public on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const callbacks = this.listeners.get(event)!;
    callbacks.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback as EventCallback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Subscribe to an event for one-time execution.
   */
  public once<T>(event: string, callback: EventCallback<T>): () => void {
    const unsubscribe = this.on<T>(event, (data) => {
      unsubscribe();
      callback(data);
    });
    return unsubscribe;
  }

  /**
   * Emit an event with data.
   */
  public emit<T>(event: string, data: T): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (_error) {
        // Error in event handler - logged but not rethrown
      }
    }
  }

  /**
   * Remove all listeners for an event.
   */
  public off(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners.
   */
  public clear(): void {
    this.listeners.clear();
  }

  /**
   * Get number of listeners for an event.
   */
  public listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

/**
 * Event types emitted by CodePulse.
 */
export interface CodePulseEvents {
  'analysis:started': { file: string };
  'analysis:completed': { file: string; result: import('../types').FileAnalysisResult };
  'analysis:error': { file: string; error: Error };
  'health:changed': {
    functionId: string;
    oldHealth: import('../types').HealthStatus;
    newHealth: import('../types').HealthStatus;
  };
  'workspace:updated': { summary: import('../types').AnalysisSummary };
  'graph:built': { stats: { totalFunctions: number; totalConnections: number } };
  'graph:updated': { changedFiles: string[] };
  'impact:calculated': { functionId: string; affected: number };
}

/**
 * Typed event bus for CodePulse events.
 */
export class TypedEventBus {
  private readonly bus = new EventBus();

  public on<K extends keyof CodePulseEvents>(
    event: K,
    callback: EventCallback<CodePulseEvents[K]>
  ): () => void {
    return this.bus.on(event, callback as EventCallback);
  }

  public once<K extends keyof CodePulseEvents>(
    event: K,
    callback: EventCallback<CodePulseEvents[K]>
  ): () => void {
    return this.bus.once(event, callback as EventCallback);
  }

  public emit<K extends keyof CodePulseEvents>(event: K, data: CodePulseEvents[K]): void {
    this.bus.emit(event, data);
  }

  public off(event: keyof CodePulseEvents): void {
    this.bus.off(event);
  }

  public clear(): void {
    this.bus.clear();
  }

  public listenerCount(event: keyof CodePulseEvents): number {
    return this.bus.listenerCount(event);
  }
}
