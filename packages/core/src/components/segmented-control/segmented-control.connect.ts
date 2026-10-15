// Segmented Control parts (design "Connect"): a radio group under its own scope (ark#2629)
// with one `item` element per segment (the radio itself), its hidden radio input as a
// sibling, and the measured selection indicator. No behaviour of its own: the props are
// Radio Group's (radioGroupConnect) and the indicator's.

import type { CompositeEnv } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { PartProps } from "../../connect/props"
import type { LinkEnv } from "../../dom/link"
import type { MeasuredIndicator } from "../../dom/selection-indicator"
import {
  type RadioGroupConnectInput,
  type RadioItemState,
  type RadioNaming,
  radioGroupConnect,
  radioGroupIds,
} from "../radio-group/radio-group.connect"
import type { RadioGroupEvent } from "../radio-group/radio-group.machine"
import { indicatorProps } from "../shared/indicator"

export type SegmentedControlPart = "root" | "label" | "item" | "indicator"

const NAMING: RadioNaming = { scope: "segmented-control", control: "item" }

export const segmentedControlIds = (root: string) => radioGroupIds(root, NAMING)

export type SegmentedControlConnectInput = Omit<
  RadioGroupConnectInput,
  "naming" | "field" | "rendered"
> & {
  readonly labelRendered?: string | undefined
  readonly indicator: MeasuredIndicator | null
}

/** One segment's interaction state. */
export type SegmentState = Omit<
  RadioItemState,
  "labelable" | "labelRendered" | "descriptionRendered"
>

export function segmentedControlConnect(
  input: SegmentedControlConnectInput,
  send: (event: RadioGroupEvent) => void,
  env: CompositeEnv & LinkEnv,
) {
  const { labelRendered, indicator, ...rest } = input
  const radio = radioGroupConnect(
    { ...rest, naming: NAMING, rendered: { label: labelRendered } },
    send,
    env,
  )
  return {
    root: radio.root,
    label: radio.label,
    /** The segment: the radio itself, named by its content. */
    item: (key: CollectionKey, s: SegmentState): PartProps => ({
      ...radio.itemControl(key, {
        ...s,
        labelable: false,
        labelRendered: false,
        descriptionRendered: false,
      }),
      "data-orientation": input.orientation,
    }),
    hiddenInput: radio.hiddenInput,
    indicator: (): PartProps =>
      indicatorProps({
        scope: NAMING.scope,
        instance: input.instance,
        orientation: input.orientation,
        selected: input.value !== null,
        indicator,
      }),
  }
}
