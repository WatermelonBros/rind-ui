// Stepper parts (add-stepper design §3): an ordered list with aria-current="step", never
// tabs (zag#1791); a step the user can reach is a button, the others text; each name ends
// with the step's status; each step's content is a labelled region, hidden unless current.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import type { StepperMessages, StepStatus } from "./stepper.messages"

export type StepperPart =
  | "root"
  | "list"
  | "item"
  | "trigger"
  | "indicator"
  | "title"
  | "description"
  | "separator"
  | "content"
  | "prev-trigger"
  | "next-trigger"
  | "progress"

export type StepperOrientation = "horizontal" | "vertical"

export interface StepperConnectInput {
  readonly instance: string
  readonly step: number
  readonly count: number
  readonly orientation: StepperOrientation
  readonly status: (index: number) => StepStatus
  readonly reachable: (index: number) => boolean
  readonly disabled: (index: number) => boolean
  readonly title: (index: number) => string
  readonly hasNext: boolean
  readonly hasPrev: boolean
  readonly ids: {
    readonly content: (index: number) => string
    readonly description: (index: number) => string
  }
  readonly messages: StepperMessages
  readonly locale: string
}

/** A focusable part's own focus, for `data-focus` / `data-focus-visible`. */
export interface StepperFocus {
  readonly focused: boolean
  readonly modality: Modality
}
const NONE: StepperFocus = { focused: false, modality: "pointer" }
const ring = (f: StepperFocus) => focusAttrs(f.focused, f.modality)

export function stepperConnect(input: StepperConnectInput) {
  const part = (name: StepperPart): PartProps => ({
    ...scopeAttrs("stepper", name, input.instance),
    "data-orientation": input.orientation,
  })
  const stepPart = (name: StepperPart, index: number): PartProps => ({
    ...part(name),
    "data-index": String(index),
    "data-status": input.status(index),
    "data-disabled": dataFlag(input.disabled(index)),
  })
  return {
    root: (): PartProps => ({ ...part("root"), role: "group" }),
    list: (): PartProps => part("list"),
    item: (index: number): PartProps => ({
      ...stepPart("item", index),
      "aria-current": index === input.step ? "step" : undefined,
    }),
    /** A button when the step is reachable, else text. */
    triggerIsButton: (index: number) => input.reachable(index),
    trigger: (index: number, hasDescription: boolean, focus: StepperFocus = NONE): PartProps => ({
      ...stepPart("trigger", index),
      ...ring(focus),
      ...(input.reachable(index) ? { type: "button" } : {}),
      "aria-describedby": hasDescription ? input.ids.description(index) : undefined,
    }),
    /**
     * The visually hidden status appended to the trigger's name ("Shipping (completed)").
     * Parentheses, not a comma: browsers put a space before a hidden span's text, so a comma
     * would read "Shipping , completed" in some engines and not others.
     */
    statusText: (index: number) => ` (${input.messages.status(input.status(index))})`,
    statusProps: (): PartProps => ({ style: visuallyHiddenStyle }),
    indicator: (index: number): PartProps => ({
      ...stepPart("indicator", index),
      "aria-hidden": "true",
    }),
    title: (index: number): PartProps => stepPart("title", index),
    description: (index: number): PartProps => ({
      ...stepPart("description", index),
      id: input.ids.description(index),
    }),
    separator: (index: number): PartProps => ({
      ...stepPart("separator", index),
      "aria-hidden": "true",
    }),
    content: (index: number, focus: StepperFocus = NONE): PartProps => ({
      ...stepPart("content", index),
      ...ring(focus),
      id: input.ids.content(index),
      role: "region",
      tabindex: -1,
      "aria-label": input.messages.stepAnnouncement(
        index,
        input.count,
        input.title(index),
        input.locale,
      ),
      hidden: index === input.step ? undefined : true,
    }),
    prevTrigger: (focus: StepperFocus = NONE): PartProps => ({
      ...part("prev-trigger"),
      ...ring(focus),
      type: "button",
      disabled: input.hasPrev ? undefined : true,
    }),
    nextTrigger: (focus: StepperFocus = NONE): PartProps => ({
      ...part("next-trigger"),
      ...ring(focus),
      type: "button",
      disabled: input.hasNext ? undefined : true,
    }),
    progress: (): PartProps => part("progress"),
    progressText: input.messages.progress(input.step, input.count, input.locale),
  }
}
