import type { CompositeHost, toolbarConnect } from "@rind-ui/core"
import { useCompositeHost, useHostItem } from "../composite-host.svelte"
import { elementRef } from "../element-ref.svelte"

/** The toolbar's parts read its connect through the host (groups re-provide it). */
export type ToolbarHost = CompositeHost & { readonly api: ReturnType<typeof toolbarConnect> }
export function useToolbar(part: string): ToolbarHost {
  const host = useCompositeHost()
  if (!host || !("api" in host)) throw new Error(`Toolbar.${part} must be inside Toolbar.Root`)
  return host as ToolbarHost // the toolbar's own host object (the only one with `api`)
}

/**
 * A control's roving wiring: its element id is its key; disabled from itself, its group or
 * the toolbar; skipped by arrows when not focusable while disabled. Call during initialisation.
 */
export function useControl(
  part: string,
  generated: string,
  own: () => {
    readonly id?: string | undefined
    readonly disabled: boolean
    readonly focusable: boolean | undefined
  },
) {
  const host = useToolbar(part)
  const el = elementRef("button")
  const id = () => own().id ?? `toolbar-control-${generated.replace(/:/g, "")}`
  const disabled = () => host.disabled || own().disabled
  const keepsFocus = () => own().focusable ?? host.focusableWhenDisabled
  useHostItem(
    host,
    () => ({ id: id(), skip: disabled() && !keepsFocus() }),
    () => el.current,
  )
  return {
    host,
    el,
    id,
    disabled,
    keepsFocus,
    roving: () => host.itemProps({ id: id(), disabled: disabled(), first: host.claimFirst(id()) }),
  }
}
