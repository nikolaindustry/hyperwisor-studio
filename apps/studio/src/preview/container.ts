/**
 * Shared singleton WebContainer instance + a prewarm() helper.
 *
 * WebContainer.boot() takes ~3–5s (downloads the runtime). Calling
 * prewarm() as soon as the user signs in starts that download in the
 * background, so by the time they open a Generate page the container is
 * already up and the only remaining cost is wc.mount() + npm install.
 *
 * Idempotent — boot is only initiated once per page lifecycle; later
 * callers just await the same promise.
 */

import { WebContainer } from "@webcontainer/api";

let bootPromise: Promise<WebContainer> | null = null;

export function getContainer(): Promise<WebContainer> {
  if (!bootPromise) {
    bootPromise = WebContainer.boot();
  }
  return bootPromise;
}

/** Fire-and-forget pre-warm. Safe to call repeatedly. */
export function prewarm(): void {
  if (!bootPromise) {
    bootPromise = WebContainer.boot();
    // swallow errors here — Preview's own error handling will surface
    // them when it awaits the promise later
    bootPromise.catch(() => {});
  }
}
