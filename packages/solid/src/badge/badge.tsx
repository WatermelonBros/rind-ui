/** @jsxImportSource solid-js */
import { badgeConnect, badgeWarnings, checkBadgeHost } from "@rind-ui/core"
import { createEffect, createMemo, createSignal, type JSX, splitProps, untrack } from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"

export interface BadgeState {
  /** A `label` replaces what assistive technology hears. */
  readonly labelled: boolean
}

export type BadgeProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** The text assistive technology gets instead of the visible content ("99+"). */
  readonly label?: string | undefined
  readonly render?: RenderProp<BadgeState> | undefined
  readonly children?: JSX.Element
}

function Root(props: BadgeProps) {
  const [local, rest] = splitProps(props, ["label", "render", "id", "children"])
  const instance = useRootId(() => local.id)
  const [el, setEl] = createSignal<Element | null>(null)
  const api = createMemo(() => badgeConnect({ label: local.label, instance: instance() }))
  const warnKey = createMemo(() =>
    JSON.stringify([rest.role, rest["aria-live"], rest["aria-label"], rest["aria-labelledby"]]),
  )
  afterMount(() => {
    // Warn once per change of what the warnings read, not on every render.
    createEffect(() => {
      if (warnKey()) badgeWarnings(untrack(() => rest as Readonly<Record<string, unknown>>))
    })
    createEffect(() => {
      const node = el()
      if (node) checkBadgeHost(node, local.label)
    })
  })
  const state = reactive<BadgeState>(() => ({ labelled: api().content() !== null }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        ...(local.id === undefined ? {} : { id: local.id }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = (): JSX.Element => {
    const content = api().content()
    const hidden = api().label()
    return content && hidden ? (
      <>
        <span {...normalizeProps(content)}>{local.children}</span>
        <span {...normalizeProps(hidden)}>{local.label}</span>
      </>
    ) : (
      local.children
    )
  }
  return renderPart(local.render, merged, state, children, (p) => <span {...p}>{children()}</span>)
}

/** Static status text (a count, a label, a dot): never interactive, never a live region. */
/** The parts, by name: `badge.parts.ts` re-exports them as the `Badge` namespace. */
export { Root }
