/**
 * Creates a debounced function that delays invoking func until after
 * wait milliseconds have elapsed since the last time the debounced
 * function was invoked.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>): void {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Creates a debounced async function.
 * Only the last call within the wait period will be executed.
 */
export function debounceAsync<
  T extends (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>
>(func: T, wait: number): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingPromise: Promise<Awaited<ReturnType<T>>> | null = null;
  let resolve: ((value: Awaited<ReturnType<T>>) => void) | null = null;
  let reject: ((error: Error) => void) | null = null;

  return function debounced(...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!pendingPromise) {
      pendingPromise = new Promise<Awaited<ReturnType<T>>>((res, rej) => {
        resolve = res;
        reject = rej;
      });
    }

    timeoutId = setTimeout(async () => {
      try {
        const result = await func(...args);
        resolve?.(result);
      } catch (error) {
        reject?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        pendingPromise = null;
        resolve = null;
        reject = null;
        timeoutId = null;
      }
    }, wait);

    return pendingPromise;
  };
}

/**
 * Creates a throttled function that only invokes func at most once
 * per every wait milliseconds.
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function throttled(...args: Parameters<T>): void {
    const now = Date.now();

    if (now - lastTime >= wait) {
      lastTime = now;
      func(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(
        () => {
          lastTime = Date.now();
          func(...args);
          timeoutId = null;
        },
        wait - (now - lastTime)
      );
    }
  };
}
