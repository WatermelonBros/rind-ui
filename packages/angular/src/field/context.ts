// The Field's context for control authors (field-control), apart from the Field's own parts: a
// control that registers with a Field ships without the Field's machine.

import { DestroyRef, Directive, InjectionToken, inject, type Signal } from "@angular/core"
import type { FieldControlBinding } from "@rind-ui/core"
import { RindIds } from "../ids"

/** The binding a rind-ui form control reads in its Root (field-control); null: none. */
export const FIELD_CONTROL = new InjectionToken<Signal<FieldControlBinding> | null>(
  "rind-ui.field-control",
)

/** Under an embedded boundary: controls join no Field and create none (field-control). */
export const FIELD_EMBEDDED = new InjectionToken<boolean>("rind-ui.field-embedded")

/** What a Field host (a Text Field Root) tells the Field it composes. */
export interface FieldHost {
  /** The scope the Field's parts carry (`text-field`). */
  readonly scope: string
  /** Inside a Field: the root's `data-part` (default `root`). */
  readonly rootPart?: string | undefined
  /**
   * The host's own invalid flag, replacing the Field's input (a Color Picker passes an explicit
   * `false`, so its Field shows valid as React's does). Set by the host in its constructor.
   */
  invalid?: () => boolean | undefined
  /** The Field's instance id (a Prompt Input's `<id>-field`). */
  id?: () => string
  /**
   * The Field renders on an element inside the host (a Prompt Input's form holds it): the
   * host applies `FieldRoot.rootProps()` there; this returns that element once rendered.
   */
  inner?: () => Element | null
}
export const FIELD_HOST = new InjectionToken<FieldHost>("rind-ui.field-host")

/**
 * Marks a subtree whose form controls are a component's own (a Color Picker's inputs): they do
 * not register with the enclosing Field, do not become a Field themselves and get no Field
 * wiring. `<ng-container rindFieldControlBoundary>`.
 */
@Directive({
  selector: "[rindFieldControlBoundary]",
  providers: [
    { provide: FIELD_CONTROL, useValue: null },
    { provide: FIELD_EMBEDDED, useValue: true },
  ],
})
export class FieldControlBoundary {}

/** Whether an enclosing Field exists (a Field host then joins it instead of creating one). */
export function injectIsInsideField(options: { skipSelf?: boolean } = {}): boolean {
  const lookup = { optional: true, ...(options.skipSelf ? { skipSelf: true } : {}) } as const
  return inject(FIELD_CONTROL, lookup) != null || inject(FIELD_EMBEDDED, lookup) === true
}

/** The enclosing Field's binding without claiming it (a host's root reads its state). */
export function injectFieldBindingPeek(): Signal<FieldControlBinding> | null {
  return inject(FIELD_CONTROL, { optional: true }) ?? null
}

/**
 * For control authors: the enclosing Field's binding, or null outside a Field or when another
 * control claimed it first. Call it in an injection context.
 */
export function injectFieldControl(
  options: {
    /** Not a control of the Field (a group's item: the group registers): claims nothing. */
    readonly skip?: boolean
  } = {},
): Signal<FieldControlBinding> | null {
  const context = inject(FIELD_CONTROL, { optional: true }) ?? null
  const binding = options.skip ? null : context
  const token = `control-${inject(RindIds).next()}`
  // One control per Field: the first to claim the binding gets it, others get none.
  const owns = binding?.().claim(token) ?? false
  inject(DestroyRef).onDestroy(() => binding?.().release(token))
  return owns ? binding : null
}
