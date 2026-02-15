/**
 * Creates a debounced version of a function that delays invoking the function
 * until after `wait` milliseconds have elapsed since the last time it was invoked.
 *
 * @param fn - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns A debounced version of the function with a cancel method
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, wait);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Creates a throttled version of a function that only invokes the function
 * at most once per every `wait` milliseconds.
 *
 * @param fn - The function to throttle
 * @param wait - The number of milliseconds to throttle invocations to
 * @returns A throttled version of the function with a cancel method
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;

  const throttled = function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args;
    lastThis = this;

    if (timeoutId === null) {
      fn.apply(this, args);
      timeoutId = setTimeout(() => {
        if (lastArgs !== null) {
          fn.apply(lastThis, lastArgs);
          lastArgs = null;
          lastThis = null;
        }
        timeoutId = null;
      }, wait);
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    lastThis = null;
  };

  return throttled;
}

/**
 * Creates a function that uses requestAnimationFrame for throttling.
 * This is optimal for visual updates as it syncs with the browser's refresh rate.
 *
 * @param fn - The function to throttle with rAF
 * @returns A rAF-throttled version of the function with a cancel method
 */
export function rafThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T
): T & { cancel: () => void } {
  let frameId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;

  const throttled = function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args;
    lastThis = this;

    if (frameId === null) {
      frameId = requestAnimationFrame(() => {
        if (lastArgs !== null) {
          fn.apply(lastThis, lastArgs);
          lastArgs = null;
          lastThis = null;
        }
        frameId = null;
      });
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    lastArgs = null;
    lastThis = null;
  };

  return throttled;
}
