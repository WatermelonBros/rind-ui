// Dialog (design §1): two states and a controllable `open`; the only DOM-touching effect is
// the overlay effect (layer, dismiss, inert, scroll lock, focus in and out). One builder
// makes the Dialog and the Alert Dialog machines, so the two never drift apart.

import type { Modality } from "../../contract/env"
import type { DismissReason, DismissRequest } from "../../dom/dismiss"
import type { FocusTarget } from "../../dom/focus-scope"
import type { LayerId, LayerKind } from "../../dom/layer-stack"
import { overlayEffect } from "../../dom/overlay"
import type { DomEnvironment } from "../../env/dom-environment"
import { partId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

declare const process: { env: { NODE_ENV?: string } }

/** A dismissal request reaching the machine (after the consumer's veto). */
type Dismissal<K extends string> = { readonly type: K; readonly request: DismissRequest }

export type DialogEvent =
  /** A trigger was activated (`trigger`: its element id, the opener). */
  | { readonly type: "TRIGGER_PRESS"; readonly trigger: string; readonly modality: Modality }
  | { readonly type: "CLOSE_TRIGGER_PRESS"; readonly modality: Modality }
  | Dismissal<"ESCAPE_KEY">
  | Dismissal<"OUTSIDE_PRESS">
  | Dismissal<"OUTSIDE_FOCUS">
  | Dismissal<"PARENT_DISMISSED">
  /** Programmatic: `api.open()` / `api.close()`. */
  | { readonly type: "OPEN" }
  | { readonly type: "CLOSE" }

export type DialogCloseReason = Exclude<DialogEvent["type"], "OPEN">

/** A cancellable event passed to `onEscapeKeyDown` / `onInteractOutside`. */
export interface DismissEvent {
  readonly event: Event | undefined
  readonly target: Element | null
  preventDefault(): void
}

export interface DialogProps {
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: ChangeDetails<DialogEvent>) => void) | undefined
  /** Default true. */
  readonly modal?: boolean | undefined
  /** Default true. */
  readonly closeOnEscape?: boolean | undefined
  /** Default: `modal`. */
  readonly closeOnInteractOutside?: boolean | undefined
  /** `null`: the overlay's rule; `false`: focus does not move; a part name or a function. */
  readonly initialFocus?: "content" | "title" | (() => FocusTarget) | null | false | undefined
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

const CLOSE_REASONS = new Set<string>([
  "TRIGGER_PRESS",
  "CLOSE_TRIGGER_PRESS",
  "ESCAPE_KEY",
  "OUTSIDE_PRESS",
  "OUTSIDE_FOCUS",
  "PARENT_DISMISSED",
  "CLOSE",
])

/** The kinds that can be a dialog's parent layer (spec "Parent Layer"). */
export const DIALOG_PARENT_KINDS: readonly LayerKind[] = ["dialog", "alertdialog", "drawer"]

export interface DialogMachineConfig {
  readonly scope: string
  readonly kind: "dialog" | "alertdialog"
}

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
  return { initialFocus: initial }
}

/** Builds a dialog-family machine (Dialog, Alert Dialog): same graph, its own kind. */
export function buildDialogMachine(config: DialogMachineConfig) {
  const { scope, kind } = config
  return setup({
    types: type<{
      props: DialogProps
      events: DialogEvent
      env: DomEnvironment
      context: DialogContext
      values: "open"
    }>(),
    guards: {
      isNonModal: ({ props }) => props.modal === false,
      // The overlay sends these only when enabled; the guards make the graph say so too.
      closesOnEscape: ({ props }) => props.closeOnEscape !== false,
      closesOnOutsidePress: ({ props }) => props.closeOnInteractOutside ?? props.modal !== false,
    },
    actions: {
      /** Entering open: the trigger that opened it, or none (programmatic, `open` prop). */
      enterOpen: ({ event, set }) => {
        set("opener", event.type === "TRIGGER_PRESS" ? event.trigger : null)
        set("closeReason", null)
      },
      // On the close transition: a controlled parent that applies the proposal closes
      // through $sync, which keeps the proposal's reason.
      setCloseReason: ({ event, set }) => {
        if (CLOSE_REASONS.has(event.type)) set("closeReason", event.type as DialogCloseReason)
      },
    },
    effects: {
      overlay: (a) => {
        const { env, send } = a
        const byId = (part: string) => env.dom.getById(partId(scope, a.props.root, part))
        const content = () => byId("content") as HTMLElement | null
        const modal = a.props.modal !== false
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
          kind,
          family: "dialog",
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
          ...(initialFocusOf(initial, content, () => byId("title") as HTMLElement | null) ?? {}),
          ...(final === null || final === undefined
            ? {}
            : {
                finalFocus:
                  final === false ? () => false : () => final(a.context.closeReason ?? undefined),
              }),
          dismiss: {
            escape: a.props.closeOnEscape !== false,
            outsidePress: a.props.closeOnInteractOutside ?? modal,
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
          // The content's own attributes: its title (aria-labelledby) or a label.
          if (!el || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return
          console.warn(
            `[rind-ui] ${scope}: #${el.id} has no accessible name; render ${scope === "dialog" ? "Dialog" : "AlertDialog"}.Title or pass aria-label`,
          )
        })
        return () => env.scheduler.cancelAnimationFrame(frame)
      },
    },
  }).machine({
    id: scope,
    initial: "closed",
    context: () => ({ opener: null, closeReason: null }),
    values: { open: { fallback: false, states: { open: true, closed: false } } },
    states: {
      closed: {
        on: { TRIGGER_PRESS: "open", OPEN: "open" },
      },
      open: {
        entry: ["enterOpen"],
        // Before the overlay's cleanup restores focus (finalFocus reads the reason); the
        // transitions set it too, for a controlled proposal the parent applies via $sync.
        exit: ["setCloseReason"],
        effects: ["overlay", "nameCheck"],
        on: {
          TRIGGER_PRESS: { guard: "isNonModal", target: "closed", actions: ["setCloseReason"] },
          CLOSE_TRIGGER_PRESS: { target: "closed", actions: ["setCloseReason"] },
          ESCAPE_KEY: { guard: "closesOnEscape", target: "closed", actions: ["setCloseReason"] },
          OUTSIDE_PRESS: {
            guard: "closesOnOutsidePress",
            target: "closed",
            actions: ["setCloseReason"],
          },
          OUTSIDE_FOCUS: { target: "closed", actions: ["setCloseReason"] },
          PARENT_DISMISSED: { target: "closed", actions: ["setCloseReason"] },
          CLOSE: { target: "closed", actions: ["setCloseReason"] },
        },
      },
    },
  })
}

/** The layer id of a dialog-family instance. */
export const layerIdOf = (scope: string, root: string) => `${scope}-${root}` as LayerId

export const dialogMachine = buildDialogMachine({ scope: "dialog", kind: "dialog" })
export type DialogMachine = typeof dialogMachine
