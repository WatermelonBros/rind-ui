// Announcement logs: what tests assert instead of live-region DOM internals.
import { ANNOUNCEMENTS, type Announcement, type Announcer } from "@rind-ui/core"

/** An announcer that only records (for machine tests in Node, or as an env override). */
export function recordingAnnouncer(): {
  readonly announcer: Announcer
  readonly log: Announcement[]
} {
  const log: Announcement[] = []
  return {
    log,
    announcer: {
      announce: (a) => {
        log.push(a)
      },
      prepare: () => () => {},
      // Records without debouncing: nothing is ever pending.
      cancel: () => {},
    },
  }
}

/**
 * The page-wide log every rind-ui announce() call appends to (any backend). Installed by
 * @rind-ui/testing/setup and by the adapters; cleared by resetRindGlobals.
 */
export function installAnnouncementLog(): Announcement[] {
  let log: Announcement[] | undefined = Reflect.get(globalThis, ANNOUNCEMENTS)
  if (!log) {
    log = []
    Reflect.set(globalThis, ANNOUNCEMENTS, log)
  }
  return log
}
