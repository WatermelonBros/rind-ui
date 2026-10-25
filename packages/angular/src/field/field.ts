import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type FieldControlBinding,
  type FieldControlReport,
  type FieldMessages,
  type FieldPart,
  fieldConnect,
  fieldDisplay,
  fieldMachine,
  fieldMessages,
  formValues,
  getLayerStack,
  labelInteraction,
  type MessageOverrides,
  partId,
  type RegisteredControl,
  registerFormValue,
  type Validate,
  type ValidationBehavior,
  type ValidationMode,
  validityCapability,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectFormBinding } from "../form/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { FIELD_CONTROL, FIELD_EMBEDDED, FIELD_HOST } from "./context"

declare const process: { env: { NODE_ENV?: string } }

export interface FieldState {
  readonly valid: boolean
  readonly invalid: boolean
  readonly validating: boolean
}

/** What the Field's parts read; `joined`: a host's parts inside another Field render nothing. */
interface FieldParts {
  readonly joined: false
  readonly scope: string
  readonly instance: () => string
  readonly registry: () => PartRegistry<FieldPart>
  readonly api: () => ReturnType<typeof fieldConnect>
  readonly setLabel: (el: Element | null) => void
  readonly control: () => RegisteredControl | null
  readonly hasErrorPart: { current: number }
}
interface JoinedParts {
  readonly joined: true
  readonly scope: string
  readonly instance: () => string
}
const FIELD_PARTS = new InjectionToken<FieldParts | JoinedParts>("rind-ui.field")

function injectParts(part: string): FieldParts | JoinedParts {
  const parts = inject(FIELD_PARTS, { optional: true })
  if (!parts) throw new Error(`rindField${part} must be inside rindFieldRoot`)
  return parts
}

/** `undefined` stays undefined (validates / uncontrolled); a bare attribute is `true`. */
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A form control with its label, description and error: `<div rindFieldRoot name="email">`
 * holding a Label, the control, a Description and an ErrorMessage. A Text Field Root composes
 * it (a host directive): alone it is the Field; inside a Field it joins that one.
 */
@Directive({
  selector: "[rindFieldRoot]",
  exportAs: "rindFieldRoot",
  providers: [
    {
      provide: FIELD_CONTROL,
      useFactory: () => inject(forwardRef(() => FieldRoot)).binding,
    },
    { provide: FIELD_PARTS, useFactory: () => inject(forwardRef(() => FieldRoot)).parts },
  ],
})
export class FieldRoot {
  readonly name = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly readonly = input(false, { transform: booleanAttribute })
  readonly required = input(false, { transform: booleanAttribute })
  /** `true` forces invalid, `false` forces valid, `undefined` validates. */
  readonly invalid = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Controlled flags. */
  readonly touched = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly dirty = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** External errors (server errors): shown at once, cleared by the next change. */
  readonly errors = input<readonly string[]>()
  readonly validate = input<Validate>()
  /** Default "submit". */
  readonly validationMode = input<ValidationMode>()
  /** Default "native". */
  readonly validationBehavior = input<ValidationBehavior>()
  readonly validationDebounce = input<number>()
  /** "both" adds `aria-errormessage` to `aria-describedby`. */
  readonly errorMessageAttribute = input<"describedby" | "both">("describedby")
  readonly messages = input<MessageOverrides<FieldMessages>>()
  readonly id = input<string>()

  /** @internal The binding the control claims (the enclosing Field's when joined). */
  readonly binding: Signal<FieldControlBinding> | null
  /** @internal */
  readonly parts: FieldParts | JoinedParts
  /** The Field's state, for the template (`#f="rindFieldRoot"`, `f.state()`). */
  readonly state: Signal<FieldState>
  /** @internal The instance id (a host's parts share it). */
  readonly instance: () => string

  constructor() {
    const host = inject(FIELD_HOST, { optional: true, self: true })
    const scope = host?.scope ?? "field"
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const enclosing = inject(FIELD_CONTROL, { optional: true, skipSelf: true }) ?? null
    const embedded = inject(FIELD_EMBEDDED, { optional: true, skipSelf: true }) === true
    // A host inside a Field joins it: the enclosing Field decides, its own Field inputs are
    // ignored; its Label, Description and ErrorMessage render nothing.
    if (host && (enclosing !== null || embedded)) {
      this.binding = enclosing
      this.parts = { joined: true, scope, instance }
      this.state = computed(() => ({ valid: false, invalid: false, validating: false }))
      bindProps(
        () => ({
          "data-scope": scope,
          "data-part": host.rootPart ?? "root",
          "data-instance": instance(),
          ...enclosing?.().data,
          id: instance(),
        }),
        { owns: FIELD_INPUTS },
      )
      return
    }

    const env = injectEnvironment(announcerCapability, validityCapability)
    const texts = injectMessages("field", fieldMessages, () => this.messages())
    const fieldsetDisabled = injectFieldsetDisabled()
    const disabled = () => this.disabled() || fieldsetDisabled()
    let labelEl: Element | null = null
    let registered: { control: RegisteredControl; label: string } | null = null
    /** The dirty baseline: the value at the first registration, once per Field. */
    let baseline: { value: unknown } | null = null
    /** Re-renders the Field (label `for`, listeners) when the registered control changes. */
    const version = signal(0)
    /** The control that claimed the binding first; any other gets none (zag#2475). */
    let owner: string | null = null
    // Inside a Form: its defaults, its server errors by name, and it leads an attempt.
    const form = injectFormBinding()
    const validationMode = () => this.validationMode() ?? form?.validationMode ?? "submit"
    const validationBehavior = () =>
      this.validationBehavior() ?? form?.validationBehavior ?? "native"
    const { view, send, service } = injectMachine(
      fieldMachine,
      () => ({
        name: this.name(),
        disabled: disabled(),
        readOnly: this.readonly(),
        required: this.required(),
        invalid: this.invalid(),
        errors: this.errors() ?? form?.errorsFor(this.name()),
        managed: form !== null,
        validate: this.validate(),
        validationMode: validationMode(),
        validationBehavior: validationBehavior(),
        validationDebounce: this.validationDebounce(),
        messages: texts(),
        label: () => (labelEl?.textContent ?? "").trim(),
        formValues: () => formValues(registered?.control.validityElement()?.form),
        control: () => registered?.control ?? null,
      }),
      env,
    )
    const registry = injectPartRegistry<FieldPart>(() => ({ scope: "field", root: instance() }))
    const labelId = injectRenderedId(registry, "label")
    const descriptionId = injectRenderedId(registry, "description")
    const errorId = injectRenderedId(registry, "error-message")
    const modality = injectModality(env.modality, () => view().context.focused)
    const api = computed(() => {
      version()
      return fieldConnect({
        instance: instance(),
        state: view().state,
        context: view().context,
        props: {
          disabled: disabled(),
          readOnly: this.readonly(),
          required: this.required(),
          invalid: this.invalid(),
        },
        touched: this.touched(),
        dirty: this.dirty(),
        modality: modality(),
        control: registered
          ? { id: registered.control.id, labelable: registered.control.labelable }
          : null,
        initial: baseline,
        name: this.name(),
        scope,
        ...(host?.rootPart === undefined ? {} : { rootPart: host.rootPart }),
      })
    })
    const hasErrorPart = { current: 0 }
    // Stable functions: a control re-registers only when it is created again.
    const register = (control: RegisteredControl, label: string) => {
      registered = { control, label }
      baseline ??= { value: control.value() }
      version.update((v) => v + 1)
      send({ type: "CONTROL.REGISTER", control })
      return () => {
        if (registered?.control.id !== control.id) return
        registered = null
        version.update((v) => v + 1)
        send({ type: "CONTROL.UNREGISTER", id: control.id })
      }
    }
    const claim = (token: string) => {
      if (owner === null || owner === token) {
        owner = token
        return true
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[rind-ui] field: a second control (${token}) is inside one Field (the first is ${owner}); only the first is wired. Use a Fieldset to group controls.`,
        )
      }
      return false
    }
    const release = (token: string) => {
      if (owner === token) owner = null
    }
    const report = (event: FieldControlReport) => {
      if (event.type === "commit") send({ type: "CONTROL.COMMIT" })
      else
        send({
          type: "CONTROL.CHANGE",
          value: event.value,
          user: event.user,
          composing: event.composing,
        })
    }
    this.binding = computed<FieldControlBinding>(() => ({
      ids: { label: labelId(), description: descriptionId(), error: errorId() },
      data: api().controlData(),
      state: {
        disabled: disabled(),
        readOnly: this.readonly(),
        required: this.required(),
        invalid: api().display === "invalid",
        validationBehavior: validationBehavior(),
      },
      name: this.name(),
      controlId: partId("field", instance(), "control"),
      errorMessageAttribute: this.errorMessageAttribute(),
      register,
      report,
      claim,
      release,
    }))
    this.parts = {
      joined: false,
      scope,
      instance,
      registry,
      api,
      setLabel: (el) => {
        labelEl = el
      },
      control: () => registered?.control ?? null,
      hasErrorPart,
    }
    this.state = computed(() => ({
      valid: api().display === "valid",
      invalid: api().display === "invalid",
      validating: view().state === "validating",
    }))
    bindProps(
      () => ({
        ...api().root(),
        // A host's Field is its root: it carries the host's id.
        ...(host ? { id: instance() } : this.id() === undefined ? {} : { id: this.id() }),
      }),
      { owns: FIELD_INPUTS },
    )

    if (inject(PLATFORM_ID) !== "browser") return
    const el: Element = inject(ElementRef).nativeElement
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      // The modality tracker must see the pointerdown that comes before focus.
      destroy.onDestroy(env.modality.subscribe(() => {}))
      // Focus entering and leaving the Field (layers opened from the control count as inside).
      const inside = (target: EventTarget | null) =>
        getLayerStack(el.ownerDocument).isLogicallyInside(target, el)
      const onIn = (e: Event) => {
        if (!inside((e as FocusEvent).relatedTarget))
          send({ type: "FOCUS.ENTER", modality: env.modality.modality() })
      }
      const onOut = (e: Event) => {
        const related = (e as FocusEvent).relatedTarget
        if (related !== null) {
          if (!inside(related)) send({ type: "FOCUS.LEAVE" })
          return
        }
        // No related target: a click on the page background (leaving), or the window losing
        // focus (not leaving). Decided once the focus settled.
        const doc = el.ownerDocument
        env.scheduler.setTimeout(() => {
          if (doc.hasFocus() && !inside(doc.activeElement)) send({ type: "FOCUS.LEAVE" })
        }, 0)
      }
      el.addEventListener("focusin", onIn)
      el.addEventListener("focusout", onOut)
      destroy.onDestroy(() => {
        el.removeEventListener("focusin", onIn)
        el.removeEventListener("focusout", onOut)
      })
      // Registered with the Form: it reads the display synchronously (right after an attempt).
      if (form) {
        destroy.onDestroy(
          form.register({
            id: instance(),
            name: this.name(),
            element: () => el,
            attempt: () => send({ type: "SUBMIT.ATTEMPT" }),
            status: () => {
              const snap = service().getSnapshot()
              return snap.state === "validating"
                ? "validating"
                : fieldDisplay(snap.state, snap.context, {
                    disabled: disabled(),
                    invalid: this.invalid(),
                  })
            },
            focus: () => registered?.control.focus("keyboard"),
            value: () => registered?.control.value(),
          }),
        )
      }
    })
    // The validity element can change when the control re-registers (`version`).
    let stop: (() => void) | undefined
    effect(() => {
      version()
      const name = this.name()
      untracked(() => {
        stop?.()
        stop = undefined
        const control = registered?.control.validityElement()
        if (!control) return
        const onInvalid = (e: Event) => {
          // The browser's bubble only when no ErrorMessage part would show the error.
          if (hasErrorPart.current > 0) e.preventDefault()
          send({ type: "INVALID" })
        }
        const owningForm = control.form
        const onReset = (e: Event) => {
          // Who asked is known now, while the reset is being dispatched: a framework reset
          // after a form action keeps the server errors.
          const keepExternal = form?.resetOrigin() === "framework"
          // After the control reset itself, and only if nobody cancelled the reset.
          env.scheduler.setTimeout(() => {
            if (!e.defaultPrevented) send({ type: "RESET", keepExternal })
          }, 0)
        }
        // A submission the browser lets through is still an attempt; inside a Form the Form
        // leads the attempt (one per form, one focus, one summary).
        const onSubmit = () => {
          if (!form) send({ type: "SUBMIT.ATTEMPT" })
        }
        control.addEventListener("invalid", onInvalid)
        owningForm?.addEventListener("reset", onReset)
        owningForm?.addEventListener("submit", onSubmit, true)
        const unregister =
          owningForm && name
            ? registerFormValue(owningForm, name, () => registered?.control.value())
            : undefined
        stop = () => {
          control.removeEventListener("invalid", onInvalid)
          owningForm?.removeEventListener("reset", onReset)
          owningForm?.removeEventListener("submit", onSubmit, true)
          unregister?.()
        }
      })
    })
    destroy.onDestroy(() => stop?.())
    // A held submission goes on once this Field's async check settled.
    let wasValidating = false
    effect(() => {
      const validating = view().state === "validating"
      if (wasValidating && !validating) untracked(() => form?.settled())
      wasValidating = validating
    })
  }
}

/** The Field's inputs (lowercase, as static attributes): the part's, never the element's. */
const FIELD_INPUTS = [
  "dirty",
  "disabled",
  "errormessageattribute",
  "errors",
  "id",
  "invalid",
  "messages",
  "name",
  "readonly",
  "required",
  "touched",
  "validate",
  "validationbehavior",
  "validationdebounce",
  "validationmode",
]

/** A host's part inside another Field: nothing (the Field's own part names it). */
function joinedPart(parts: JoinedParts, name: string) {
  if (process.env.NODE_ENV !== "production" && inject(PLATFORM_ID) === "browser") {
    afterNextRender(() =>
      console.warn(
        `[rind-ui] ${parts.scope}: its ${name} is not rendered inside a Field; use the Field's ${name}.`,
      ),
    )
  }
  bindProps(() => absentProps(parts.scope, parts.instance()))
}

/** The control's label: `<label rindFieldLabel>`. */
@Directive({
  selector: "[rindFieldLabel], [rindTextFieldLabel], [rindNumberInputLabel], [rindPinInputLabel]",
  exportAs: "rindFieldLabel",
})
export class FieldLabel {
  readonly id = input<string>()
  constructor() {
    const parts = injectParts("Label")
    if (parts.joined) {
      joinedPart(parts, "Label")
      return
    }
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    parts.setLabel(el)
    const own = () => this.id() ?? partId("field", parts.instance(), "label")
    injectRegisterPart(parts.registry, "label", own)
    // A non-labelable control (a group) is named by aria-labelledby; a press focuses it.
    const interaction = labelInteraction(env, {
      target: () => null,
      forwardsFocus: () => parts.control()?.labelable === false,
      focusTarget: () => parts.control()?.focus("pointer"),
    })
    bindProps(
      () => {
        const part = parts.api().label(own())
        return joinHandlers(
          {
            ...part,
            // Before the control registers (server render) the Field's control id is assumed.
            for: parts.control() ? part["for"] : partId("field", parts.instance(), "control"),
          },
          interaction,
        )
      },
      { owns: ["for", "id"] },
    )
  }
}

@Directive({
  selector:
    "[rindFieldDescription], [rindTextFieldDescription], [rindNumberInputDescription], [rindPinInputDescription]",
  exportAs: "rindFieldDescription",
})
export class FieldDescription {
  readonly id = input<string>()
  constructor() {
    const parts = injectParts("Description")
    if (parts.joined) {
      joinedPart(parts, "Description")
      return
    }
    const own = () => this.id() ?? partId("field", parts.instance(), "description")
    injectRegisterPart(parts.registry, "description", own)
    bindProps(() => parts.api().description(own()), { owns: ["id"] })
  }
}

/**
 * The error, shown while the Field is invalid (and during its exit): its content, or the
 * messages (a list when there are several). Hidden otherwise (React renders nothing).
 */
@Component({
  selector:
    "[rindFieldErrorMessage], [rindTextFieldErrorMessage], [rindNumberInputErrorMessage], [rindPinInputErrorMessage]",
  exportAs: "rindFieldErrorMessage",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content
    >@if (messages().length > 1) {
      <ul>
        @for (m of messages(); track m) {
          <li>{{ m }}</li>
        }
      </ul>
    } @else {
      {{ messages()[0] }}
    }</ng-content
  >`,
})
export class FieldErrorMessage {
  readonly id = input<string>()
  /** Rendered only when this validity key caused the error (one message per constraint). */
  readonly match = input<string>()
  /** @internal */
  protected readonly messages: () => readonly string[]
  constructor() {
    const parts = injectParts("ErrorMessage")
    if (parts.joined) {
      this.messages = () => []
      joinedPart(parts, "ErrorMessage")
      return
    }
    const fieldParts = parts
    this.messages = () => fieldParts.api().messages
    // Counted while rendered: the Field cancels the browser bubble only when one exists.
    fieldParts.hasErrorPart.current += 1
    inject(DestroyRef).onDestroy(() => {
      fieldParts.hasErrorPart.current -= 1
    })
    const el: Element = inject(ElementRef).nativeElement
    const open = () =>
      fieldParts.api().display === "invalid" &&
      (this.match() === undefined || this.match() === fieldParts.api().errorKey)
    const presence = injectPresence(open, el)
    const own = () => this.id() ?? partId("field", fieldParts.instance(), "error-message")
    injectRegisterPart(fieldParts.registry, "error-message", () =>
      presence.mounted() ? own() : undefined,
    )
    bindProps(
      () =>
        presence.mounted()
          ? fieldParts.api().errorMessage(own())
          : absentProps(fieldParts.scope, fieldParts.instance()),
      { owns: ["id", "match"] },
    )
  }
}

/** The Field's parts, for a standalone component's `imports`. */
export const Field = [FieldRoot, FieldLabel, FieldDescription, FieldErrorMessage] as const
