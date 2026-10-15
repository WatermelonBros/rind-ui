import {
  checkLabelTarget,
  labelConnect,
  labelForwardsFocus,
  labelInteraction,
  labelTarget,
} from "@rind-ui/core"
import { type ComponentPropsWithRef, useEffect, useRef, useState } from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useRenderedTag } from "../use-rendered-tag"

export type LabelProps = ComponentPropsWithRef<"label"> & {
  /** Another element; a non-`<label>` forwards focus to `htmlFor`'s element itself. */
  readonly render?: RenderProp<undefined>
}

/** A native `<label>`: names its control through `for` or by wrapping it. */
function LabelRoot({ id, htmlFor, render, ref, ...rest }: LabelProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("label", render, el)
  // Known after commit only: the server keeps the consumer's `for` (design §3).
  const [nonLabelable, setNonLabelable] = useState(false)
  useEffect(() => {
    if (el.current) setNonLabelable(checkLabelTarget(el.current, htmlFor))
  }, [htmlFor])
  const forwardsFocus = labelForwardsFocus(tag, nonLabelable)
  const own = normalizeProps(labelConnect({ instance, id: instance, htmlFor, tag, forwardsFocus }))
  const interaction = labelInteraction(env, {
    target: () => (el.current ? labelTarget(el.current, htmlFor) : null),
    forwardsFocus: () => forwardsFocus,
  })
  const props = mergeProps({ ...own, ...interaction, ref: composeRefs(el, ref) }, rest)
  return renderPart("label", props, render, undefined)
}

export const Label = Object.assign(LabelRoot, { Root: LabelRoot })
