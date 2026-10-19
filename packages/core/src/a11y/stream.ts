// How streamed text (AI responses) is announced without flooding: by default exactly once,
// with the full text, on completion; in sentence mode, each complete sentence (the
// locale's sentence segmentation) or the accumulated text at most every 2 s, politely.
// Complete sentences are each spoken (unkeyed: a keyed debounce would drop all but the
// last); the periodic flush and the completion text are keyed per stream, so a backlog of
// partial text collapses. A cancelled stream announces nothing more.

import type { Announcer, Scheduler, TimerHandle } from "../env/capabilities"

export interface StreamOptions {
  readonly mode?: "completion" | "sentences"
  /** Coalesces this stream's pending announcements. */
  readonly key: string
  readonly locale: string
  readonly scheduler: Scheduler
  /** Sentence mode: announce the unannounced text at least this often (default 2000 ms). */
  readonly flushMs?: number
}

export interface AnnouncementStream {
  push(chunk: string): void
  complete(): void
  cancel(): void
}

const segmenters = new Map<string, Intl.Segmenter>()
/** The locale's sentence segments of `text` (the last one may still be growing). */
export function splitSentences(locale: string, text: string): string[] {
  let segmenter = segmenters.get(locale)
  if (!segmenter) {
    segmenter = new Intl.Segmenter(locale, { granularity: "sentence" })
    segmenters.set(locale, segmenter)
  }
  return [...segmenter.segment(text)].map((s) => s.segment)
}

export function streamAnnouncement(announcer: Announcer, o: StreamOptions): AnnouncementStream {
  let text = ""
  /** How much of `text` has been announced (sentence mode). */
  let announced = 0
  let done = false
  let flushTimer: TimerHandle | null = null
  const say = (message: string, keyed: boolean) => {
    const m = message.trim()
    if (!m) return
    announcer.announce({
      message: m,
      priority: "polite",
      lang: o.locale,
      ...(keyed ? { key: o.key } : {}),
    })
  }
  const stopFlush = () => {
    if (flushTimer !== null) o.scheduler.clearTimeout(flushTimer)
    flushTimer = null
  }
  const announceSentences = (final: boolean) => {
    const rest = text.slice(announced)
    const parts = splitSentences(o.locale, rest)
    // The last segment may still be growing, unless the stream is complete.
    const complete = final ? parts : parts.slice(0, -1)
    for (const part of complete) {
      say(part, false)
      announced += part.length
    }
  }
  return {
    push(chunk) {
      if (done) return
      text += chunk
      if (o.mode !== "sentences") return
      announceSentences(false)
      if (flushTimer === null && announced < text.length) {
        flushTimer = o.scheduler.setTimeout(() => {
          flushTimer = null
          if (done) return
          // Unkeyed like the sentences around it: a keyed (debounced) flush would be spoken
          // after the sentence that completes it.
          say(text.slice(announced), false)
          announced = text.length
        }, o.flushMs ?? 2000)
      }
    },
    complete() {
      if (done) return
      done = true
      stopFlush()
      if (o.mode === "sentences") announceSentences(true)
      else say(text, true)
    },
    cancel() {
      done = true
      stopFlush()
      // A completion still in the announcer's debounce must not be spoken either.
      announcer.cancel(o.key)
    },
  }
}
