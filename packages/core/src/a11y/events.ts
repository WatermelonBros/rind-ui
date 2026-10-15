// Interaction events rind-ui's interaction modules send to machines. Pure types: machines
// import them without importing anything that touches the DOM.

import type { Modality } from "../contract/env"

export type { Modality }

/** The input that produced a press (`virtual`: assistive technology). */
export type PointerKind = "mouse" | "pen" | "touch" | "keyboard" | "virtual"

export interface ModifierState {
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly altKey: boolean
}

export interface InteractionEventBase extends ModifierState {
  readonly modality: Modality
  readonly pointerType: PointerKind
}

export type PressEventType = "PRESS.START" | "PRESS.UP" | "PRESS.END" | "PRESS" | "PRESS.CANCEL"
export interface PressEvent extends InteractionEventBase {
  readonly type: PressEventType
}
export interface LongPressEvent extends InteractionEventBase {
  readonly type: "LONG_PRESS"
}
/** A context-menu request from a pointer (macOS Control+click) or a long press. */
export interface ContextMenuEvent extends InteractionEventBase {
  readonly type: "CONTEXT_MENU"
}
export interface HoverEvent {
  readonly type: "HOVER.START" | "HOVER.END"
  readonly modality: Modality
  readonly pointerType: "mouse" | "pen"
}

/**
 * Why focus moved: rind-ui's own moves (`layer`: initial focus or restore of a layer;
 * `navigation`: roving, Tab wrap, typeahead; `programmatic`: any other), or what preceded
 * a focus rind-ui did not move (`key`, `pointer`, `window` regaining focus, `other`).
 */
export type FocusCause =
  | "layer"
  | "navigation"
  | "programmatic"
  | "key"
  | "pointer"
  | "window"
  | "other"

export interface FocusEvent {
  readonly type: "FOCUS"
  readonly modality: Modality
  readonly cause: FocusCause
}
export interface BlurEvent {
  readonly type: "BLUR"
  readonly modality: Modality
}

export type LogicalKey =
  | "NEXT"
  | "PREV"
  | "FIRST"
  | "LAST"
  | "PAGE_NEXT"
  | "PAGE_PREV"
  | "EXPAND"
  | "COLLAPSE"
  | "INCREASE"
  | "DECREASE"
  | "ACTIVATE"
  | "DISMISS"
  | "CONTEXT_MENU"

export interface LogicalKeyEvent {
  readonly type: LogicalKey
  readonly modality: "keyboard"
  readonly shift: boolean
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  /** The platform modifier: Meta on Apple platforms, Control elsewhere. */
  readonly mod: boolean
  readonly composing: boolean
}
