import { EtagMismatch, FetchSource, type RangeResponse } from "pmtiles";

const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
type Archive = RangeResponse;
const cancelled = () => new DOMException("Request cancelled", "AbortError");
export function isTransientMapError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      /Bad response code: (408|429|5\d\d)\b/.test(error.message))
  );
}
function waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(cancelled());
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancelled());
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(cancelled());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
async function boundedBody(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty archive response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Map archive exceeds the supported download size");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data.buffer;
}
function responseEtag(response: Response) {
  const tag = response.headers.get("ETag");
  return tag && !tag.startsWith("W/") ? tag : undefined;
}
/** Prefer byte ranges; share one bounded full-archive download if the host returns HTTP 200. */
export class ResilientMapSource extends FetchSource {
  private fullMode = false;
  private archive?: Promise<Archive>;
  private lifetime = new AbortController();
  dispose() {
    this.lifetime.abort();
  }
  private checkEtag(expected?: string, actual?: string) {
    if (expected && actual && expected !== actual) {
      this.mustReload = true;
      throw new EtagMismatch("Map archive ETag changed");
    }
  }
  private async fetchArchive(): Promise<Archive> {
    const download = new AbortController();
    const stop = () => download.abort();
    this.lifetime.signal.addEventListener("abort", stop, { once: true });
    if (this.lifetime.signal.aborted) download.abort();
    const timer = setTimeout(() => download.abort(), 30000);
    try {
      const headers = new Headers(this.customHeaders);
      headers.delete("Range");
      const response = await fetch(this.url, {
        headers,
        signal: download.signal,
        cache: "reload",
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error(`Bad response code: ${response.status}`);
      }
      const data = await boundedBody(response, MAX_ARCHIVE_BYTES);
      const magic = new TextDecoder().decode(data.slice(0, 7));
      if (magic !== "PMTiles")
        throw new Error("Response is not a PMTiles archive");
      return {
        data,
        etag: responseEtag(response),
        cacheControl: response.headers.get("Cache-Control") || undefined,
      };
    } catch (error) {
      if (download.signal.aborted && !this.lifetime.signal.aborted)
        throw new Error("Map archive download timed out");
      throw error;
    } finally {
      clearTimeout(timer);
      this.lifetime.signal.removeEventListener("abort", stop);
    }
  }
  private async fromArchive(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    signal?.throwIfAborted();
    if (!this.archive)
      this.archive = this.fetchArchive().catch((error) => {
        this.archive = undefined;
        throw error;
      });
    const archive = await waitFor(this.archive, signal);
    signal?.throwIfAborted();
    this.checkEtag(etag, archive.etag);
    if (offset < 0 || offset >= archive.data.byteLength || length <= 0)
      throw new Error("Invalid archive byte range");
    return { ...archive, data: archive.data.slice(offset, offset + length) };
  }
  private async range(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    if (this.fullMode) return this.fromArchive(offset, length, signal, etag);
    const headers = new Headers(this.customHeaders);
    headers.set("Range", `bytes=${offset}-${offset + length - 1}`);
    const response = await fetch(this.url, {
      headers,
      signal: signal || this.lifetime.signal,
      cache: this.mustReload
        ? "reload"
        : this.chromeWindowsNoCache
          ? "no-store"
          : undefined,
    });
    if (response.status === 200) {
      // Cancel the ignored range body; a separate request without Range is unambiguous.
      await response.body?.cancel();
      this.fullMode = true;
      return this.fromArchive(offset, length, signal, etag);
    }
    if (response.status === 416) {
      await response.body?.cancel();
      this.mustReload = true;
      throw new EtagMismatch("Map archive byte range changed");
    }
    if (response.status !== 206) {
      await response.body?.cancel();
      throw new Error(`Bad response code: ${response.status}`);
    }
    const actualEtag = responseEtag(response);
    if (etag && actualEtag && etag !== actualEtag) {
      await response.body?.cancel();
      this.checkEtag(etag, actualEtag);
    }
    const range = response.headers
      .get("Content-Range")
      ?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if (
      !range ||
      +range[1] !== offset ||
      +range[2] < offset ||
      +range[2] >= offset + length ||
      +range[2] >= +range[3]
    ) {
      await response.body?.cancel();
      throw new Error("Invalid Content-Range in map response");
    }
    const data = await boundedBody(response, length);
    if (data.byteLength !== +range[2] - offset + 1)
      throw new Error("Incomplete map byte range");
    return {
      data,
      etag: actualEtag,
      cacheControl: response.headers.get("Cache-Control") || undefined,
      expires: response.headers.get("Expires") || undefined,
    };
  }
  override async getBytes(...args: Parameters<FetchSource["getBytes"]>) {
    for (let attempt = 0; ; attempt++) {
      this.lifetime.signal.throwIfAborted();
      args[2]?.throwIfAborted();
      try {
        return await this.range(...args);
      } catch (error) {
        if (this.lifetime.signal.aborted || args[2]?.aborted) throw cancelled();
        if (attempt >= 2 || !isTransientMapError(error)) throw error;
        await delay([200, 600][attempt], args[2] || this.lifetime.signal);
      }
    }
  }
}
