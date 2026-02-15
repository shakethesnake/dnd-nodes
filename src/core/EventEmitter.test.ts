import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "./EventEmitter";

interface TestEvents {
  connected: { edgeId: string };
  count: number;
}

describe("EventEmitter", () => {
  it("emits payload to typed listeners", () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    emitter.on("connected", listener);

    emitter.emit("connected", { edgeId: "e-1" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ edgeId: "e-1" });
  });

  it("supports once listeners", () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    emitter.once("count", listener);

    emitter.emit("count", 1);
    emitter.emit("count", 2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(1);
  });

  it("supports off", () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    emitter.on("count", listener);
    emitter.off("count", listener);

    emitter.emit("count", 42);

    expect(listener).not.toHaveBeenCalled();
  });

  it("supports wildcard listeners", () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    emitter.on("*", listener);

    emitter.emit("count", 7);

    expect(listener).toHaveBeenCalledWith("count", 7);
  });
});

