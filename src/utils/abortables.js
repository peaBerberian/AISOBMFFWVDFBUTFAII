import { toUint8Array } from "./bytes";
import { sleep } from "./sleep";

/**
 * Make an async iterable from a Stream, while also letting the event loop spin
 * after each iteration.
 * This allows two things:
 *   - We can stop the iterator when the `AbortSignal` aborts, without
 *     continuing to read the stream.
 *   - If parsing is excessively CPU-intensive, the DOM can still take time to
 *     update itself, preventing visual freezes.
 * @param {ReadableStream<import("isobmff-inspector").ISOBMFFByteChunk>} stream
 * @param {AbortSignal} signal
 * @returns {AsyncIterable<Uint8Array>}
 */
export function createAbortableAsyncIterable(stream, signal) {
  // Adaptive thresholds (ms)
  const NO_WORK_THRESHOLD = 16; // ~1 frame
  const HEAVY_WORK_THRESHOLD = 100; // CPU monopolized

  const MODERATE_SLEEP = 16;
  const HEAVY_SLEEP = 70;

  return {
    async *[Symbol.asyncIterator]() {
      const reader = stream.getReader();
      let lastSleepTime = performance.now();

      try {
        while (true) {
          const result = await readWithAbort(reader, signal);
          if (result.done) {
            break;
          }
          yield toUint8Array(result.value);

          // Adaptive sleep based on work intensity
          const now = performance.now();
          const workTime = now - lastSleepTime;

          let sleepMs;
          if (workTime > NO_WORK_THRESHOLD) {
            if (workTime < HEAVY_WORK_THRESHOLD) {
              sleepMs = MODERATE_SLEEP; // Moderate work: brief pause
            } else {
              sleepMs = HEAVY_SLEEP; // Heavy work: full frame to recover
            }

            if (sleepMs > 0) {
              await sleep(sleepMs);
            }
            lastSleepTime = performance.now();
          }

          throwIfAborted(signal);
        }
      } finally {
        if (signal.aborted) {
          await reader.cancel(signal.reason).catch(() => {});
        }
        reader.releaseLock();
      }
    },
  };
}

/**
 * @template T
 * @param {ReadableStreamDefaultReader<T>} reader
 * @param {AbortSignal} signal
 * @returns {Promise<ReadableStreamReadResult<T>>}
 */
export function readWithAbort(reader, signal) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(
        signal.reason ??
          new DOMException("The operation was aborted.", "AbortError"),
      );
    };
    signal.addEventListener("abort", onAbort, { once: true });
    reader.read().then(
      (result) => {
        cleanup();
        resolve(result);
      },
      (err) => {
        cleanup();
        reject(err);
      },
    );
  });
}

/**
 * @param {AbortSignal} signal
 */
export function throwIfAborted(signal) {
  if (signal.aborted) {
    throw (
      signal.reason ??
      new DOMException("The operation was aborted.", "AbortError")
    );
  }
}
