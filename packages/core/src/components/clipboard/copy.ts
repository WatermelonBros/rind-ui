// The copy logic Clipboard and Code Block share (clipboard spec "Shared Copy Logic"): one
// clipboard write per entry to `copying`, and the result's announcement.

import type { AnnouncerEnv, ClipboardEnv } from "../../env/capabilities"

export type CopyResultEvent =
  | { readonly type: "COPY.DONE" }
  | { readonly type: "COPY.FAILED"; readonly error?: unknown }

/**
 * Writes `text` and sends the result, synchronously in the caller's task (WebKit rejects a
 * write that starts after an `await`). A synchronous throw becomes a rejection; a result that
 * arrives after the returned cleanup ran (the state was left) is dropped.
 */
export function writeClipboard(
  env: ClipboardEnv,
  text: string,
  near: Element | null | undefined,
  send: (event: CopyResultEvent) => void,
): () => void {
  let live = true
  let write: Promise<void>
  try {
    write = env.clipboard.writeText(text, near ? { near } : {})
  } catch (error) {
    write = Promise.reject(error)
  }
  write.then(
    () => {
      if (live) send({ type: "COPY.DONE" })
    },
    (error: unknown) => {
      if (live) send({ type: "COPY.FAILED", error })
    },
  )
  return () => {
    live = false
  }
}

/** Announces a copy's result, keyed per instance so two instances never coalesce. */
export function announceCopy(
  env: AnnouncerEnv,
  a: {
    readonly scope: string
    readonly id: string
    readonly message: string
    readonly lang?: string | undefined
  },
): void {
  env.announcer.announce({
    message: a.message,
    priority: "polite",
    key: `${a.scope}-${a.id}`,
    ...(a.lang === undefined ? {} : { lang: a.lang }),
  })
}
