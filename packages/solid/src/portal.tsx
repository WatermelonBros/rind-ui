/** @jsxImportSource solid-js */
import { portalHostAttributes, resolvePortalTarget, syncPortalHost } from "@rind-ui/core"
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
} from "solid-js"
import { insert } from "solid-js/web"
import { CompositeHostContext } from "./composite-host"
import { afterMount } from "./lifecycle"
import { mergeProps } from "./merge-props"
import { type RenderProp, renderPart } from "./render"
import { SeparatorHostContext } from "./separator/separator"

export type PortalProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Where to render (default: resolved from the logical parent, then `body`). */
  readonly container?: Element | ShadowRoot | null | undefined
  /** The element the content belongs to (its trigger): target resolution and dir/lang/theme. */
  readonly logicalParent?: (() => Element | null) | undefined
  /**
   * Keeps the host's `dir`, `lang` and theme in step with the logical parent as they change;
   * `false` copies them once. Default: true.
   */
  readonly observe?: boolean | undefined
  /** Renders another element with the host's props, in place of the host `div`. */
  readonly render?: RenderProp<undefined> | undefined
  /** The content rendered into the portal host. */
  readonly children?: JSX.Element
}

const sameAttributes = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

/**
 * Renders its children into a host `div[data-rind-portal]` outside the tree, as React's
 * createPortal does (no wrapper of Solid's own `Portal`). Nothing on the server and nothing
 * during hydration (no mismatch: radix#1386); mounts after. The host carries the logical
 * parent's dir, lang, data-rind-theme and data-theme, kept in sync, and follows a changing
 * `container` (radix#3599). Context crosses it: the content is created under this component.
 */
export function Portal(props: PortalProps) {
  const [local, rest] = splitProps(props, [
    "container",
    "logicalParent",
    "observe",
    "render",
    "children",
  ])
  const parent = () => local.logicalParent?.() ?? null
  const [mounted, setMounted] = createSignal(false)
  afterMount(() => setMounted(true))
  const [attributes, setAttributes] = createSignal<Record<string, string>>(
    {},
    { equals: sameAttributes },
  )
  // The first render after mount already has the right attributes (no flash in the wrong dir),
  // and a logical parent that changes (a dialog's opener, set on open) is followed at once.
  createEffect(() => {
    if (mounted()) setAttributes(portalHostAttributes(parent()))
  })
  // A signal, not a variable: a new container remounts the host, and the sync follows it.
  const [host, setHost] = createSignal<HTMLElement | null>(null)
  createEffect(() => {
    const el = host()
    const observe = local.observe !== false
    if (el) onCleanup(syncPortalHost(el, parent, observe))
  })
  const merged = createMemo(() =>
    mergeProps({ "data-rind-portal": "", ...attributes(), ref: setHost }, rest),
  )
  // A component in a popup is not hosted by the toolbar its trigger sits in (nor are its
  // separators drawn in the toolbar's context).
  const content = () => (
    <CompositeHostContext.Provider value={null}>
      <SeparatorHostContext.Provider value={null}>{local.children}</SeparatorHostContext.Provider>
    </CompositeHostContext.Provider>
  )
  // A memo: a logical parent that changes while the target stays (a dialog's opener, set on
  // open) must not remount the content.
  const resolved = createMemo(() =>
    mounted() ? resolvePortalTarget(parent(), local.container) : null,
  )
  createEffect(() => {
    const target = resolved()
    if (!target) return
    // After the target's own children: a marker keeps `insert` from replacing them.
    const marker = document.createTextNode("")
    target.appendChild(marker)
    untrack(() => {
      const node = renderPart(local.render, merged, undefined, content, (p) => (
        <div {...p}>{content()}</div>
      ))
      insert(target as Element, node, marker)
    })
    onCleanup(() => {
      host()?.remove()
      setHost(null)
      marker.remove()
    })
  })
  return null
}
