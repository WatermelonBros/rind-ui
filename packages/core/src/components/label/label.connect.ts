// The Label has no machine (design §2): a native <label>, plus label-interaction.

import { type PartProps, scopeAttrs } from "../../connect/props"

export interface LabelConnectInput {
  readonly instance: string
  readonly id: string
  readonly htmlFor?: string | undefined
  /** The rendered tag; `for` only means something on a <label>. */
  readonly tag: string
  /** After commit: `for` names a non-labelable element, so focus is forwarded instead. */
  readonly forwardsFocus: boolean
}

/** No role and no ARIA, ever (radix#638): the native element does the naming. */
export function labelConnect(input: LabelConnectInput): PartProps {
  const keepsFor = input.tag === "label" && !input.forwardsFocus
  return {
    ...scopeAttrs("label", "root", input.instance),
    id: input.id,
    for: keepsFor ? input.htmlFor : undefined,
  }
}

/** Whether the label must forward focus itself: a non-label element, or a non-labelable target. */
export const labelForwardsFocus = (tag: string, nonLabelableTarget: boolean) =>
  tag !== "label" || nonLabelableTarget
