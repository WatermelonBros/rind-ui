// Dialog (design §1): two states and a controllable `open`; the only DOM-touching effect is
// the overlay effect (layer, dismiss, inert, scroll lock, focus in and out). One builder
// makes the Dialog and the Drawer machines; `role="alertdialog"` is a Dialog whose props
// fix its confirmation behaviour, never a second machine (reka-ui#2702).

import type { Modality } from "../../contract/env"
import type { DismissReason, DismissRequest } from "../../dom/dismiss"
import type { FocusTarget } from "../../dom/focus-scope"
import type { LayerId, LayerKind } from "../../dom/layer-stack"
import { overlayEffect } from "../../dom/overlay"
import type { DomEnvironment } from "../../env/dom-environment"
import { partId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ActionFn, ChangeDetails, EffectFn, GuardFn } from "../../machine/types"

declare const process: { env: { NODE_ENV?: string } }

/** The Dialog machine's type parameters (the pieces are typed against them). */
export interface DialogTypes {
  props: DialogProps
  events: DialogEvent
  env: DomEnvironment
  context: DialogContext
  values: "open"
}
export interface DialogSetup {
  readonly guards: Record<string, GuardFn<DialogTypes>>
  readonly actions: Record<string, ActionFn<DialogTypes>>
  readonly effects: Record<string, EffectFn<DialogTypes>>
}

/** A dismissal request reaching the machine (after the consumer's veto). */
type Dismissal<K extends string> = { readonly type: K; readonly request: DismissRequest }

export type DialogEvent =
  /** A trigger was activated (`trigger`: its element id, the opener). */
  | { readonly type: "TRIGGER_PRESS"; readonly trigger: string; readonly modality: Modality }
  | { readonly type: "CLOSE_TRIGGER_PRESS"; readonly modality: Modality }
  /** Cancel and Action parts (`action`: the pressed action's id). */
  | { readonly type: "CANCEL_PRESS"; readonly modality: Modality }
  | { readonly type: "ACTION_PRESS"; readonly action: string; readonly modality: Modality }
  | Dismissal<"ESCAPE_KEY">
  | Dismissal<"OUTSIDE_PRESS">
  | Dismissal<"OUTSIDE_FOCUS">
  | Dismissal<"PARENT_DISMISSED">
  /** Programmatic: `api.open()` / `api.close()`. */
  | { readonly type: "OPEN" }
  | { readonly type: "CLOSE" }

/** Why the dialog closed (`onOpenChange`'s `details.reason`, `data-close-reason`). */
export type DialogCloseReason =
  | "trigger"
  | "close-trigger"
  | "cancel"
  | "action"
  | "escape-key"
  | "outside-press"
  | "outside-focus"
  | "parent-dismissed"
  | "api"
  /** The Drawer: a swipe toward its edge. */
  | "swipe"
/** Why it opened: a trigger press, or programmatic (`actionsRef`, the `open` prop). */
export type DialogOpenReason = "trigger" | "api"

/** `onOpenChange`'s details: `reason` says why it opens or closes. */
export type DialogChangeDetails = Omit<ChangeDetails<DialogEvent>, "reason"> & {
  readonly reason: DialogOpenReason | DialogCloseReason
}

/** A cancellable event passed to `onEscapeKeyDown` / `onInteractOutside`. */
export interface DismissEvent {
  readonly event: Event | undefined
  readonly target: Element | null
  preventDefault(): void
}

export interface DialogProps {
  /**
   * `"alertdialog"`: a confirmation that interrupts. Always modal, an outside press never
   * closes it, focus starts on Cancel, and a missing description warns.
   */
  readonly role?: "dialog" | "alertdialog" | undefined
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: DialogChangeDetails) => void) | undefined
  /** Default true. */
  readonly modal?: boolean | undefined
  /** Default true. */
  readonly closeOnEscape?: boolean | undefined
  /** Default: `modal`. */
  readonly closeOnInteractOutside?: boolean | undefined
  /** `null`: the overlay's rule; `false`: focus does not move; a part name or a function. */
  readonly initialFocus?:
    | "content"
    | "title"
    | "cancel"
    | (() => FocusTarget)
    | null
    | false
    | undefined
  /** `null`: back to the opener; `false`: focus does not move. */
  readonly finalFocus?:
    | ((reason: DialogCloseReason | undefined) => FocusTarget)
    | null
    | false
    | undefined
  readonly onEscapeKeyDown?: ((event: DismissEvent) => void) | undefined
  readonly onInteractOutside?: ((event: DismissEvent) => void) | undefined
  /** The instance id (part ids derive from it). */
  readonly root: string
  /** The nearest dialog-like layer this one was opened from (the adapter's layer context). */
  readonly parent?: LayerId | undefined
}

export interface DialogContext {
  /** The trigger that opened the dialog (its id); null when opened programmatically. */
  readonly opener: string | null
  /** The last close reason, until the next open (`data-close-reason`). */
  readonly closeReason: DialogCloseReason | null
}

const DISMISSALS: Record<DismissReason, Dismissal<string>["type"]> = {
  "escape-key": "ESCAPE_KEY",
  "outside-press": "OUTSIDE_PRESS",
  "outside-focus": "OUTSIDE_FOCUS",
  "parent-dismissed": "PARENT_DISMISSED",
}

/** Each closing event's reason. */
const CLOSE_REASONS: Partial<Record<string, DialogCloseReason>> = {
  TRIGGER_PRESS: "trigger",
  CLOSE_TRIGGER_PRESS: "close-trigger",
  CANCEL_PRESS: "cancel",
  ACTION_PRESS: "action",
  ESCAPE_KEY: "escape-key",
  OUTSIDE_PRESS: "outside-press",
  OUTSIDE_FOCUS: "outside-focus",
  PARENT_DISMISSED: "parent-dismissed",
  CLOSE: "api",
  SWIPE: "swipe",
}

/**
 * The kinds that can be a dialog's parent layer (spec "Parent Layer"). A popover is one: a
 * dialog opened from it keeps it open (zag#2933); a menu is not (radix#1836).
 */
export const DIALOG_PARENT_KINDS: readonly LayerKind[] = [
  "dialog",
  "alertdialog",
  "drawer",
  "popover",
  // A dialog opened from a tour's card or target keeps the tour on its step.
  "tour",
]

/** The parts whose press closes the dialog (each a close event of the graph). */
type ClosePart = "CLOSE_TRIGGER_PRESS" | "CANCEL_PRESS" | "ACTION_PRESS"

export interface DialogMachineConfig {
  readonly scope: string
  readonly kind: "dialog" | "drawer"
  /** Nesting metadata counts this family only (default "dialog": Dialog in both roles). */
  readonly family?: string
  /** The parts whose press closes it (default: the close trigger). */
  readonly closeParts?: readonly ClosePart[]
}

/** `role="alertdialog"`: the confirmation's fixed behaviour (spec "Alert Dialog Role"). */
export const isAlertDialog = (props: Pick<DialogProps, "role">) => props.role === "alertdialog"

/** The overlay's `initialFocus` option for the prop (none: the overlay's default rule). */
function initialFocusOf(
  initial: DialogProps["initialFocus"],
  content: () => HTMLElement | null,
  title: () => HTMLElement | null,
): { readonly initialFocus: () => FocusTarget } | undefined {
  if (initial === null || initial === undefined) return undefined
  if (initial === false) return { initialFocus: () => false }
  if (initial === "content") return { initialFocus: content }
  if (initial === "title") return { initialFocus: title }
  // At focus time, from the live content: never a node replaced since (bits-ui#2136).
  if (initial === "cancel") {
    return {
      initialFocus: () =>
        // A disabled Cancel cannot take focus: the content then, inside the modal.
        content()?.querySelector<HTMLElement>(
          '[data-part="cancel"]:not([disabled]):not([aria-disabled="true"])',
        ) ?? content(),
    }
  }
  return { initialFocus: initial }
}

/**
 * The dialog family's machine pieces (Dialog, Drawer): guards, actions,
 * effects and both states' transitions, so a member composes them with its own (the Drawer)
 * instead of copying the graph. `buildDialogMachine` assembles them as they are.
 */
export function dialogPieces(config: DialogMachineConfig) {
  const { scope, kind } = config
  const closeParts = config.closeParts ?? ["CLOSE_TRIGGER_PRESS"]
  const isModal = (props: DialogProps) => isAlertDialog(props) || props.modal !== false
  const closeOnOutside = (props: DialogProps) =>
    isAlertDialog(props) ? false : (props.closeOnInteractOutside ?? isModal(props))
  const guards = {
    isNonModal: ({ props }) => !isModal(props),
    // The overlay sends these only when enabled; the guards make the graph say so too.
    closesOnEscape: ({ props }) => props.closeOnEscape !== false,
    closesOnOutsidePress: ({ props }) => closeOnOutside(props),
  } satisfies DialogSetup["guards"]
  const actions = {
    /** Entering open: the trigger that opened it, or none (programmatic, `open` prop). */
    enterOpen: ({ event, set }) => {
      set("opener", event.type === "TRIGGER_PRESS" ? event.trigger : null)
      set("closeReason", null)
    },
    // On the close transition: a controlled parent that applies the proposal closes
    // through $sync, which keeps the proposal's reason.
    setCloseReason: ({ event, set }) => {
      const reason = CLOSE_REASONS[event.type]
      if (reason) set("closeReason", reason)
    },
  } satisfies DialogSetup["actions"]
  const effects = {
    overlay: (a) => {
      const { env, send } = a
      const byId = (part: string) => env.dom.getById(partId(scope, a.props.root, part))
      const content = () => byId("content") as HTMLElement | null
      const modal = isModal(a.props)
      // A non-modal dialog's triggers belong to it: pressing one toggles, not outside.
      const triggers = () =>
        modal
          ? []
          : Array.from(
              content()?.ownerDocument.querySelectorAll(
                `[data-scope="${scope}"][data-part="trigger"][data-instance="${a.props.root}"]`,
              ) ?? [],
            )
      let closed = false
      const veto = (handler: ((e: DismissEvent) => void) | undefined, r: DismissRequest) => {
        let prevented = false
        handler?.({ event: r.event, target: r.target, preventDefault: () => (prevented = true) })
        return prevented
      }
      const initial = a.props.initialFocus
      const final = a.props.finalFocus
      const stop = overlayEffect(env, {
        id: layerIdOf(scope, a.props.root),
        kind: isAlertDialog(a.props) ? "alertdialog" : kind,
        family: config.family ?? "dialog",
        modal,
        parent: a.props.parent,
        parentKinds: DIALOG_PARENT_KINDS,
        opener: () => (a.context.opener ? env.dom.getById(a.context.opener) : null),
        elements: () =>
          [...triggers(), byId("positioner"), byId("backdrop"), content()].filter(
            (e): e is Element => e !== null,
          ),
        surfaces: () => [byId("positioner"), byId("backdrop")].filter((e) => e !== null),
        container: content,
        modality: env.modality.modality(),
        ...(initialFocusOf(
          initial === undefined && isAlertDialog(a.props) ? "cancel" : initial,
          content,
          () => byId("title") as HTMLElement | null,
        ) ?? {}),
        ...(final === null || final === undefined
          ? {}
          : {
              finalFocus:
                final === false ? () => false : () => final(a.context.closeReason ?? undefined),
            }),
        dismiss: {
          escape: a.props.closeOnEscape !== false,
          outsidePress: closeOnOutside(a.props),
          // Non-modal dialogs are worked alongside the page (zag#2957): no focus dismissal.
          outsideFocus: false,
          onRequest: (request) => {
            const handler =
              request.reason === "escape-key"
                ? a.props.onEscapeKeyDown
                : request.reason === "parent-dismissed"
                  ? undefined
                  : a.props.onInteractOutside
            if (veto(handler, request)) {
              request.cancel()
              return
            }
            send({ type: DISMISSALS[request.reason], request } as DialogEvent) // the mapped dismissal type
            // A controlled parent that kept it open vetoes: nothing beneath is dismissed.
            if (!closed) request.cancel()
          },
        },
      })
      return () => {
        closed = true
        stop()
      }
    },
    /** One frame after open: one development warning when the dialog has no name. */
    nameCheck: (a) => {
      const { env, props } = a
      if (process.env.NODE_ENV === "production") return undefined
      const frame = env.scheduler.requestAnimationFrame(() => {
        const el = env.dom.getById(partId(scope, props.root, "content"))
        if (!el) return
        const name = scope === "drawer" ? "Drawer" : "Dialog"
        // The content's own attributes: its title (aria-labelledby) or a label.
        if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
          console.warn(
            `[rind-ui] ${scope}: #${el.id} has no accessible name; render ${name}.Title or pass aria-label`,
          )
        }
        if (isAlertDialog(props) && !el.getAttribute("aria-describedby")) {
          console.warn(
            `[rind-ui] ${scope}: #${el.id} has no description; render ${name}.Description with the alert message`,
          )
        }
      })
      return () => env.scheduler.cancelAnimationFrame(frame)
    },
  } satisfies DialogSetup["effects"]
  return {
    guards,
    actions,
    effects,
    context: (): DialogContext => ({ opener: null, closeReason: null }),
    closedOn: {
      TRIGGER_PRESS: { target: "open", reason: "trigger" },
      OPEN: { target: "open", reason: "api" },
    } as const,
    open: {
      entry: ["enterOpen"],
      // Before the overlay's cleanup restores focus (finalFocus reads the reason); the
      // transitions set it too, for a controlled proposal the parent applies via $sync.
      exit: ["setCloseReason"],
      effects: ["overlay", "nameCheck"],
      on: {
        TRIGGER_PRESS: {
          guard: "isNonModal",
          target: "closed",
          reason: "trigger",
          actions: ["setCloseReason"],
        },
        ...Object.fromEntries(
          closeParts.map((e) => [
            e,
            { target: "closed", reason: CLOSE_REASONS[e], actions: ["setCloseReason"] },
          ]),
        ),
        ESCAPE_KEY: {
          guard: "closesOnEscape",
          target: "closed",
          reason: "escape-key",
          actions: ["setCloseReason"],
        },
        OUTSIDE_PRESS: {
          guard: "closesOnOutsidePress",
          target: "closed",
          reason: "outside-press",
          actions: ["setCloseReason"],
        },
        OUTSIDE_FOCUS: { target: "closed", reason: "outside-focus", actions: ["setCloseReason"] },
        PARENT_DISMISSED: {
          target: "closed",
          reason: "parent-dismissed",
          actions: ["setCloseReason"],
        },
        CLOSE: { target: "closed", reason: "api", actions: ["setCloseReason"] },
      },
    } as const,
  }
}

/** Builds a dialog-family machine (Dialog, Alert Dialog): same graph, its own kind. */
export function buildDialogMachine(config: DialogMachineConfig) {
  const pieces = dialogPieces(config)
  return setup({
    types: type<DialogTypes>(),
    guards: pieces.guards,
    actions: pieces.actions,
    effects: pieces.effects,
  }).machine({
    id: config.scope,
    initial: "closed",
    context: pieces.context,
    values: { open: { fallback: false, states: { open: true, closed: false } } },
    states: {
      closed: { on: pieces.closedOn },
      open: pieces.open,
    },
  })
}

/** The layer id of a dialog-family instance. */
export const layerIdOf = (scope: string, root: string) => `${scope}-${root}` as LayerId

export const dialogMachine = buildDialogMachine({
  scope: "dialog",
  kind: "dialog",
  // Cancel and Action are Dialog parts: a confirmation uses them, any dialog may.
  closeParts: ["CLOSE_TRIGGER_PRESS", "CANCEL_PRESS", "ACTION_PRESS"],
})
export type DialogMachine = typeof dialogMachine
