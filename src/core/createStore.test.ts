import { describe, it, expect, vi } from 'vitest';
import { createStore } from './createStore';

describe('createStore', () => {
  it('should create a store with initial state', () => {
    const store = createStore({ count: 0 });
    expect(store.getState()).toEqual({ count: 0 });
  });

  it('should update state with partial object', () => {
    const store = createStore({ count: 0, name: 'test' });
    store.setState({ count: 5 });
    expect(store.getState()).toEqual({ count: 5, name: 'test' });
  });

  it('should update state with function updater', () => {
    const store = createStore({ count: 0 });
    store.setState((prev) => ({ count: prev.count + 1 }));
    expect(store.getState()).toEqual({ count: 1 });
  });

  it('should notify subscribers on state change', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();

    store.subscribe(listener);
    store.setState({ count: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe listeners', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.setState({ count: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should support multiple subscribers', () => {
    const store = createStore({ count: 0 });
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    store.subscribe(listener1);
    store.subscribe(listener2);
    store.setState({ count: 1 });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('getSnapshot should return current state', () => {
    const store = createStore({ count: 0 });
    store.setState({ count: 42 });
    expect(store.getSnapshot()).toEqual({ count: 42 });
  });

  it('should handle full state replacement with function updater', () => {
    const store = createStore({ count: 0, name: 'old' });
    store.setState(() => ({ count: 10, name: 'new' }));
    expect(store.getState()).toEqual({ count: 10, name: 'new' });
  });
});
