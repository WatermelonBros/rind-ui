// One delay group per document (delay-group spec): stored on the document under a versioned
// global key, so two copies of @rind-ui/core share it and iframes never mix. A plain object,
// no DOM events (reka-ui#2868); the warm window runs on the injected scheduler and is
// independent of members' close delays (react-spectrum#9517).

import type { DomEnv, SchedulerEnv, TimerHandle } from "../env/capabilities"
import type { DelayGroup, DelayGroupMember } from "../env/delay-group"
import { registerReset } from "./resets"

const KEY = Symbol.for("rind-ui.delay-group@1")

interface State {
  readonly members: Map<string, DelayGroupMember>
  open: string | null
  warm: boolean
  timer: TimerHandle | null
}

function stateOf(doc: Document): State {
  let s = Reflect.get(doc, KEY) as State | undefined
  if (!s) {
    s = { members: new Map(), open: null, warm: false, timer: null }
    Reflect.set(doc, KEY, s)
  }
  return s
}
registerReset(() => {
  if (typeof document !== "undefined") Reflect.deleteProperty(document, KEY)
})

/** The document's delay group, timed by `env.scheduler`. */
export function domDelayGroup(env: DomEnv & SchedulerEnv): DelayGroup {
  const state = () => {
    const root = env.dom.getRootNode()
    return stateOf("body" in root ? root : root.ownerDocument)
  }
  const cool = (s: State) => {
    if (s.timer !== null) env.scheduler.clearTimeout(s.timer)
    s.timer = null
  }
  const closed = (id: string, skipDelay: number) => {
    const s = state()
    if (s.open !== id) return
    s.open = null
    cool(s)
    s.warm = skipDelay > 0
    if (s.warm) {
      s.timer = env.scheduler.setTimeout(() => {
        s.warm = false
        s.timer = null
      }, skipDelay)
    }
  }
  return {
    join(id, member) {
      state().members.set(id, member)
      return (skipDelay) => {
        closed(id, skipDelay)
        state().members.delete(id)
      }
    },
    isWarm: () => {
      const s = state()
      return s.open !== null || s.warm
    },
    opened(id) {
      const s = state()
      const previous = s.open
      s.open = id
      cool(s)
      s.warm = false
      if (previous !== null && previous !== id) s.members.get(previous)?.replace()
    },
    closed,
  }
}
