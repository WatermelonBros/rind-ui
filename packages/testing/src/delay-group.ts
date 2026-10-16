// Fakes of the hover-intent and delay-group capabilities for machine tests in Node.

import type {
  DelayGroup,
  DelayGroupMember,
  HoverIntent,
  HoverIntentTrackOptions,
} from "@rind-ui/core"

export interface FakeDelayGroup extends DelayGroup {
  /** The member ids, and which one is open. */
  readonly members: ReadonlyMap<string, DelayGroupMember>
  readonly open: string | null
  /** Makes the group warm (or cold) as if a member had just closed. */
  setWarm(warm: boolean): void
}

/** A delay group without timers: warm while a member is open or after `setWarm(true)`. */
export function fakeDelayGroup(): FakeDelayGroup {
  const members = new Map<string, DelayGroupMember>()
  let open: string | null = null
  let warm = false
  return {
    get members() {
      return members
    },
    get open() {
      return open
    },
    setWarm: (w) => {
      warm = w
    },
    join(id, member) {
      members.set(id, member)
      return () => {
        if (open === id) open = null
        members.delete(id)
      }
    },
    isWarm: () => open !== null || warm,
    opened(id) {
      const previous = open
      open = id
      if (previous !== null && previous !== id) members.get(previous)?.replace()
    },
    closed(id, skipDelay) {
      if (open !== id) return
      open = null
      warm = skipDelay > 0
    },
  }
}

export interface FakeHoverIntent extends HoverIntent {
  /** The live `track()` calls (stopped ones removed). */
  readonly tracked: readonly HoverIntentTrackOptions[]
  /** The pointer left (or re-entered) every tracked hover zone. */
  leave(): void
  enter(): void
  inTransit: boolean
}

export function fakeHoverIntent(): FakeHoverIntent {
  const live = new Set<HoverIntentTrackOptions>()
  return {
    inTransit: false,
    get tracked() {
      return [...live]
    },
    track(options) {
      live.add(options)
      return () => live.delete(options)
    },
    isInTransit() {
      return this.inTransit
    },
    leave: () => {
      for (const o of [...live]) o.onLeave()
    },
    enter: () => {
      for (const o of [...live]) o.onEnter()
    },
    triggerProps: (send) => ({
      onPointerMove: (e) => {
        if (e.pointerType === "mouse" || e.pointerType === "pen") send({ type: "HOVER.START" })
      },
      onPointerLeave: (e) => {
        if (e.pointerType === "mouse" || e.pointerType === "pen") send({ type: "HOVER.END" })
      },
    }),
  }
}
