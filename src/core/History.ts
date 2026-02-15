// core/History.ts
import type { GraphState } from "../types/types";

/**
 * Configuration for history management
 */
export interface HistoryConfig {
  /** Maximum number of snapshots to keep (default: 50) */
  maxSize?: number;
  /** Time window in ms to merge consecutive operations (default: 300) */
  mergeInterval?: number;
}

/**
 * A single history snapshot with metadata
 */
export interface HistorySnapshot {
  /** Complete graph state at this point in time */
  state: GraphState;
  /** Timestamp when snapshot was created */
  timestamp: number;
  /** Optional label describing the action */
  label?: string;
}

/**
 * History manager for undo/redo functionality
 * Uses snapshot-based approach for simplicity
 */
export class History {
  private past: HistorySnapshot[] = [];
  private future: HistorySnapshot[] = [];
  private maxSize: number;
  private mergeInterval: number;
  private lastSnapshotTime = 0;

  constructor(config: HistoryConfig = {}) {
    this.maxSize = config.maxSize ?? 50;
    this.mergeInterval = config.mergeInterval ?? 300;
  }

  /**
   * Add a new snapshot to history
   * Merges with previous snapshot if within merge interval
   * @param state - Current graph state
   * @param label - Optional description of the change
   * @param force - Force new snapshot even if within merge interval
   */
  push(state: GraphState, label?: string, force = false): void {
    const now = Date.now();
    const shouldMerge = !force && (now - this.lastSnapshotTime) < this.mergeInterval;

    if (shouldMerge && this.past.length > 0) {
      // Replace last entry (merge consecutive operations like drag moves)
      this.past[this.past.length - 1] = {
        state: this.cloneState(state),
        timestamp: now,
        label,
      };
    } else {
      // Add new entry
      this.past.push({
        state: this.cloneState(state),
        timestamp: now,
        label,
      });

      // Keep history size under limit
      if (this.past.length > this.maxSize) {
        this.past.shift();
      }
    }

    this.lastSnapshotTime = now;
    this.future = []; // Clear redo stack on new action
  }

  /**
   * Undo last action
   * @param currentState - Current state to save for redo
   * @returns Previous state or null if nothing to undo
   */
  undo(currentState: GraphState): GraphState | null {
    if (this.past.length === 0) return null;

    const snapshot = this.past.pop()!;
    this.future.push({
      state: this.cloneState(currentState),
      timestamp: Date.now(),
    });

    return snapshot.state;
  }

  /**
   * Redo previously undone action
   * @param currentState - Current state to save for undo
   * @returns Next state or null if nothing to redo
   */
  redo(currentState: GraphState): GraphState | null {
    if (this.future.length === 0) return null;

    const snapshot = this.future.pop()!;
    this.past.push({
      state: this.cloneState(currentState),
      timestamp: Date.now(),
    });

    return snapshot.state;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.past.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.past = [];
    this.future = [];
    this.lastSnapshotTime = 0;
  }

  /**
   * Get history info for debugging
   */
  getInfo() {
    return {
      pastSize: this.past.length,
      futureSize: this.future.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      maxSize: this.maxSize,
      mergeInterval: this.mergeInterval,
    };
  }

  /**
   * Deep clone state for snapshot
   * Uses JSON serialization for simplicity
   */
  private cloneState(state: GraphState): GraphState {
    return JSON.parse(JSON.stringify(state));
  }
}
