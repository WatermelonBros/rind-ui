// Skeleton (design §2): `loading` / `loaded` bound to the `loading` prop. The only side
// effect is the optional completion announcement, made on a real `loading → loaded` change
// (a `$sync` step), never when the service starts already loaded (chakra-ui#2864).

import type { AnnouncerEnv } from "../../env/capabilities"
import { bindProp, setup, type } from "../../machine/setup"
import type { SkeletonMessages } from "./skeleton.messages"

export interface SkeletonProps {
  /** Default `true`. */
  readonly loading?: boolean | undefined
  /** `true` announces `messages.loaded`; a string announces itself. Default: silent. */
  readonly announceOnLoad?: boolean | string | undefined
  readonly messages: SkeletonMessages
  /** For the announcement's key. */
  readonly id: string
  readonly lang?: string | undefined
}

const announces = (props: SkeletonProps) =>
  props.announceOnLoad !== undefined && props.announceOnLoad !== false

export const skeletonMachine = setup({
  types: type<{ props: SkeletonProps; events: never; env: AnnouncerEnv }>(),
  actions: {
    announceLoaded: ({ props, env, event }) => {
      // `$start`: created loaded, or the first entry; only the parent's change announces.
      if (event.type !== "$sync" || !announces(props)) return
      const { announceOnLoad, messages, id, lang } = props
      env.announcer.announce({
        message: typeof announceOnLoad === "string" ? announceOnLoad : messages.loaded,
        priority: "polite",
        key: `skeleton-${id}`,
        ...(lang === undefined ? {} : { lang }),
      })
    },
  },
  effects: {
    prepareAnnouncer: ({ props, env }) => (announces(props) ? env.announcer.prepare() : undefined),
  },
}).machine({
  id: "skeleton",
  initial: "loading",
  values: { loading: bindProp({ fallback: true, states: { loading: true, loaded: false } }) },
  effects: ["prepareAnnouncer"],
  states: {
    loading: {},
    loaded: { entry: ["announceLoaded"] },
  },
})

export type SkeletonMachine = typeof skeletonMachine
