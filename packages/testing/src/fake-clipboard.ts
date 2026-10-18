// A clipboard for tests (spec clipboard "Fake in node tests"): records writes, and succeeds,
// rejects or behaves as absent as the test says. Pass it as `domEnvironment({ clipboard })`
// (RindProvider `environment={{ clipboard }}`) or in a machine env. With a scheduler (a virtual
// clock's), a write settles after `latency` ms of that clock, so `copying` is observable.

import type { Clipboard, Scheduler } from "@rind-ui/core"

export type FakeClipboardMode = "succeed" | "reject" | "absent"

export interface FakeClipboard extends Clipboard {
  /** Every text written, successful or not, in order. */
  readonly log: readonly string[]
  /** The texts of the writes that succeeded. */
  readonly copied: readonly string[]
  set(mode: FakeClipboardMode): void
}

export interface FakeClipboardOptions {
  readonly mode?: FakeClipboardMode
  readonly scheduler?: Scheduler
  /** With `scheduler`: how long a write takes (default 10 ms). */
  readonly latency?: number
}

export function fakeClipboard(options: FakeClipboardOptions = {}): FakeClipboard {
  let mode = options.mode ?? "succeed"
  const log: string[] = []
  const copied: string[] = []
  const settle = (text: string, m: FakeClipboardMode) => {
    if (m === "succeed") {
      copied.push(text)
      return Promise.resolve()
    }
    return Promise.reject(new Error(m === "absent" ? "No clipboard" : "Write rejected"))
  }
  return {
    log,
    copied,
    set: (next) => {
      mode = next
    },
    writeText(text) {
      log.push(text)
      const m = mode
      const { scheduler } = options
      if (!scheduler) return settle(text, m)
      return new Promise<void>((resolve, reject) => {
        scheduler.setTimeout(() => settle(text, m).then(resolve, reject), options.latency ?? 10)
      })
    },
  }
}
