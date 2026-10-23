<script lang="ts">
import type { Announcer, DomEnvironmentOptions } from "@rind-ui/core"
import { type AnyScopedMessages, resolveProvider } from "@rind-ui/core/internal"
import type { Snippet } from "svelte"
import type { RindIcons } from "./icons"
import { rindContext, type ScopedMessages } from "./provider"

interface Props {
  readonly locale?: string
  /** Default: the locale's direction. */
  readonly dir?: "ltr" | "rtl"
  readonly messages?: ScopedMessages
  readonly announcer?: Announcer | "live-region" | "aria-notify"
  /** Typeahead reset delay for every component below (default 1000 ms). */
  readonly typeaheadTimeout?: number
  /** Further environment overrides (platform, reduced motion, nonce, …). */
  readonly environment?: DomEnvironmentOptions
  /** Icon components by name, rendered by indicator parts that got no children. */
  readonly icons?: RindIcons
  readonly children?: Snippet
}

const props: Props = $props()
const parent = rindContext.maybe()
const config = $derived(
  resolveProvider<RindIcons>(parent?.(), {
    locale: props.locale,
    dir: props.dir,
    // ScopedMessages is a typed view of the same record shape.
    messages: props.messages as AnyScopedMessages | undefined,
    announcer: props.announcer,
    typeaheadTimeout: props.typeaheadTimeout,
    environment: props.environment,
    icons: props.icons,
  }),
)
rindContext.set(() => config)
</script>

{@render props.children?.()}
