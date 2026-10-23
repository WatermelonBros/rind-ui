<script lang="ts">
import {
  announcerCapability,
  createListCollection,
  layoutCapability,
  type SeparatorOrientation,
  toolbarConnect,
  toolbarIds,
  toolbarMachine,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { compositeHost } from "../composite-host.svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { separatorHost } from "../separator/context"
import { useCollectionItems } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import type { ToolbarHost } from "./host.svelte"
import type { ToolbarRootProps } from "./types"

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

const {
  orientation = "horizontal",
  loop = true,
  disabled = false,
  focusableWhenDisabled = true,
  id,
  child,
  children,
  ...rest
}: ToolbarRootProps = $props()

const env = useEnvironment(announcerCapability, layoutCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const ids = $derived(toolbarIds(instance))
const items = useCollectionItems()
const collection = $derived(items.collection ?? EMPTY)
const machine = useMachine(
  toolbarMachine,
  () => ({
    collection,
    strategy: "roving" as const,
    ids,
    loop,
    // Each control registers as skipped when it is not focusable while disabled.
    focusableWhenDisabled: false,
    orientation,
    disabled,
  }),
  env,
)
const api = $derived(
  toolbarConnect(
    {
      instance,
      collection,
      highlightedKey: machine.view.context.highlightedKey,
      focusWithin: machine.view.matches("focused"),
      pending: items.collection === null,
      orientation,
      disabled,
      focusableWhenDisabled,
    },
    machine.send,
    env,
  ),
)
/** Focuses the toolbar's tab stop (for an application shortcut such as Alt+F10). */
export function focus() {
  machine.send({ type: "FOCUS_TOOLBAR" })
}
// Initialisation order (the server tab stop): the first control to ask.
let first: string | null = null
// Getters: the controls read the toolbar's current props.
const host: ToolbarHost = {
  kind: "toolbar",
  get orientation() {
    return orientation
  },
  get disabled() {
    return disabled
  },
  get focusableWhenDisabled() {
    return focusableWhenDisabled
  },
  register: items.registry.register,
  itemProps: (item) => api.control(item),
  claimFirst: (id) => {
    first ??= id
    return first === id
  },
  get api() {
    return api
  },
}
compositeHost.set(host)
separatorHost.set(() => ({
  context: "toolbar",
  defaultOrientation: (orientation === "horizontal"
    ? "vertical"
    : "horizontal") as SeparatorOrientation,
}))
const el = elementRef("div")
// Development: a toolbar needs a name (aria-label or aria-labelledby).
$effect(() => {
  const node = el.current
  void rest["aria-label"]
  if (!DEV || !node) return
  if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
    console.warn(
      `[rind-ui] toolbar: #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
    )
  }
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(api.root()), ...el.props }, rest)),
)
const current = $derived({ orientation, disabled })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
