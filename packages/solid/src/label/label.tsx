/** @jsxImportSource solid-js */
import {
  checkLabelTarget,
  labelConnect,
  labelForwardsFocus,
  labelInteraction,
  labelTarget,
} from "@rind-ui/core"
import { createEffect, createMemo, createSignal, type JSX, splitProps } from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

export type LabelProps = Omit<JSX.LabelHTMLAttributes<HTMLLabelElement>, "children"> & {
  /** Another element; a non-`<label>` forwards focus to `for`'s element itself. */
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

/** A native `<label>`: names its control through `for` or by wrapping it. */
function LabelRoot(props: LabelProps) {
  const [local, rest] = splitProps(props, ["id", "for", "render", "children"])
  const env = useEnvironment()
  const instance = useRootId(() => local.id)
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = () => (local.render ? (el()?.tagName.toLowerCase() ?? "label") : "label")
  // Known after mount only: the server keeps the consumer's `for` (design §3).
  const [nonLabelable, setNonLabelable] = createSignal(false)
  afterMount(() =>
    createEffect(() => {
      const node = el()
      if (node) setNonLabelable(checkLabelTarget(node, local.for))
    }),
  )
  const forwardsFocus = () => labelForwardsFocus(tag(), nonLabelable())
  const own = createMemo(() =>
    normalizeProps(
      labelConnect({
        instance: instance(),
        id: instance(),
        htmlFor: local.for,
        tag: tag(),
        forwardsFocus: forwardsFocus(),
      }),
    ),
  )
  const interaction = normalizeProps(
    labelInteraction(env, {
      target: () => {
        const node = el()
        return node ? labelTarget(node, local.for) : null
      },
      forwardsFocus,
    }),
  )
  const merged = createMemo(() => mergeProps({ ...own(), ...interaction, ref: setEl }, rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: the consumer's props carry `for`, or wrap the control
    <label {...p}>{children()}</label>
  ))
}

export const Label = Object.assign(LabelRoot, { Root: LabelRoot })
