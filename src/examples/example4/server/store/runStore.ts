/**
 * Run Store — In-memory Flow Execution State
 *
 * Tracks active and recently completed flow runs.
 * TTL-based cleanup removes finished runs after a configurable period.
 * Enforces a maximum concurrent run limit.
 */

import type {
  FlowRunHandle,
  FlowExecutionState,
  FlowEventListener,
  FlowEvent,
} from "../engine/flowTypes";

// ── Configuration ────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 5 * 60 * 1_000; // 5 minutes
const DEFAULT_MAX_CONCURRENT = 5;
const CLEANUP_INTERVAL_MS = 30 * 1_000; // sweep every 30s

// ── Types ────────────────────────────────────────────────────────────

export interface RunEntry {
  handle: FlowRunHandle;
  state: FlowExecutionState;
  /** Buffered events for SSE replay / late subscribers */
  events: FlowEvent[];
  createdAt: number;
  completedAt?: number;
}

export interface RunStoreOptions {
  /** Max concurrent running flows (default: 5) */
  maxConcurrent?: number;
  /** TTL in ms for completed runs before cleanup (default: 5 min) */
  ttlMs?: number;
}

// ── Store ────────────────────────────────────────────────────────────

export class RunStore {
  private readonly runs = new Map<string, RunEntry>();
  private readonly maxConcurrent: number;
  private readonly ttlMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: RunStoreOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.cleanupTimer = setInterval(() => this.sweep(), CLEANUP_INTERVAL_MS);
  }

  /** Number of currently running flows */
  get activeCount(): number {
    let count = 0;
    for (const entry of this.runs.values()) {
      if (entry.state.status === "running") count++;
    }
    return count;
  }

  /** Check if we can accept another run */
  canAcceptRun(): boolean {
    return this.activeCount < this.maxConcurrent;
  }

  /**
   * Register a new flow run.
   * Subscribes to events and buffers them for SSE replay.
   */
  add(runId: string, handle: FlowRunHandle, state: FlowExecutionState): RunEntry {
    const entry: RunEntry = {
      handle,
      state,
      events: [],
      createdAt: Date.now(),
    };

    // Buffer events
    handle.on((event: FlowEvent) => {
      entry.events.push(event);

      // Track completion time for TTL
      if (
        event.type === "flow-completed" ||
        event.type === "flow-error" ||
        event.type === "flow-cancelled"
      ) {
        entry.completedAt = Date.now();
      }
    });

    this.runs.set(runId, entry);
    return entry;
  }

  /** Get a run entry by ID */
  get(runId: string): RunEntry | undefined {
    return this.runs.get(runId);
  }

  /** Check if a run exists */
  has(runId: string): boolean {
    return this.runs.has(runId);
  }

  /** Get all run IDs */
  listRunIds(): string[] {
    return [...this.runs.keys()];
  }

  /**
   * Subscribe to live events for a specific run.
   * Returns all buffered events immediately, then live events going forward.
   */
  subscribe(
    runId: string,
    listener: FlowEventListener,
  ): { buffered: FlowEvent[]; unsubscribe: () => void } | null {
    const entry = this.runs.get(runId);
    if (!entry) return null;

    // Return already-buffered events
    const buffered = [...entry.events];

    // Subscribe to future events
    const unsubscribe = entry.handle.on(listener);

    return { buffered, unsubscribe };
  }

  /** Remove completed/expired runs */
  private sweep(): void {
    const now = Date.now();
    for (const [runId, entry] of this.runs) {
      if (
        entry.completedAt != null &&
        now - entry.completedAt > this.ttlMs
      ) {
        this.runs.delete(runId);
      }
    }
  }

  /** Shut down the store (stop cleanup timer) */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    // Cancel all active runs
    for (const entry of this.runs.values()) {
      if (entry.state.status === "running") {
        entry.handle.cancel();
      }
    }
    this.runs.clear();
  }
}
