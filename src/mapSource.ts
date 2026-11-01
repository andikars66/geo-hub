import { FetchSource } from "pmtiles";

export function isTransientMapError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      /Bad response code: (408|429|5\d\d)\b/.test(error.message))
  );
}
function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Request cancelled", "AbortError"));
    };
    if (signal?.aborted) {
      reject(new DOMException("Request cancelled", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
/** Retry only temporary transport failures. Range, ETag and integrity checks remain in FetchSource. */
export class ResilientMapSource extends FetchSource {
  override async getBytes(...args: Parameters<FetchSource["getBytes"]>) {
    for (let attempt = 0; ; attempt++) {
      args[2]?.throwIfAborted();
      try {
        return await super.getBytes(...args);
      } catch (error) {
        if (args[2]?.aborted)
          throw new DOMException("Request cancelled", "AbortError");
        if (attempt >= 2 || !isTransientMapError(error)) throw error;
        await delay([200, 600][attempt], args[2]);
      }
    }
  }
}
