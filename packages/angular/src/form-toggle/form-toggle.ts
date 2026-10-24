// The parts every form toggle shares (Checkbox, Switch): a button-like Control with a checkable
// role, Label/Description (control-label) and the hidden form input (hidden-form-input), wired to
// the component's own machine through `service`. Each component extends these base classes.

import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  viewChild,
} from "@angular/core"
import {
  type BlurEvent,
  blurEvent,
  type CheckedState,
  checkboxConnect,
  type FieldControlBinding,
  type FocusEvent,
  type FormInputCapability,
  focusEvent,
  focusSafely,
  type GroupedCheckbox,
  hiddenFormInput,
  implicitSubmit,
  isImeKey,
  labelInteraction,
  type Modality,
  mergeFieldProps,
  type PartProps,
  partId,
  warnOwnLabelInField,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { bindProps, joinHandlers } from "../bind-props"
import { injectFieldControl } from "../field/context"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectEnvironment } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"

const mirrorOf = (v: CheckedState) => ({
  checked: v === true,
  indeterminate: v === "indeterminate",
})

export interface FormToggleState<V extends CheckedState = CheckedState> {
  readonly checked: V
  readonly disabled: boolean
  readonly readOnly: boolean
}

/** The events a form toggle's machine takes from its parts. */
export type FormToggleEvent =
  | { readonly type: "TOGGLE"; readonly modality: Modality }
  | { readonly type: "RESET" }
  | FocusEvent
  | BlurEvent

/** What the shared parts read from a component's machine. */
export interface FormToggleService {
  readonly checked: () => CheckedState
  readonly focused: () => boolean
  send(event: FormToggleEvent): void
}

/** The machine props a component's service receives (read at use). */
export interface FormToggleServiceProps<V extends CheckedState, D> {
  readonly checked: V | undefined
  readonly defaultChecked: V
  readonly onCheckedChange: (checked: V, details: D) => void
  readonly disabled: boolean
  readonly readOnly: boolean
}

export interface FormToggleConfig {
  readonly scope: "checkbox" | "switch"
  readonly role: "checkbox" | "switch"
  /** The decorative part ("indicator", or the Switch's "thumb"). */
  readonly indicatorPart: "indicator" | "thumb"
  /** Names the component's root in errors ("rindCheckboxRoot"). */
  readonly root: string
}

/** How a Checkbox Group (or its select-all Parent) drives a Checkbox inside it. */
export interface FormToggleGrouping {
  /** The props for the Checkbox with this `value`, or null when it is not grouped. */
  resolve(
    value: string,
    own: { readonly disabled: boolean; readonly readOnly: boolean; readonly required: boolean },
  ): FormToggleGrouped | null
}
export interface FormToggleGrouped {
  readonly props: GroupedCheckbox
  /** The user's proposal: the group decides. */
  onChange(checked: CheckedState, modality: Modality): void
  /** The rendered Control's id and disabled flag; returns the unregistration. */
  register?(controlId: string, disabled: boolean): () => void
}

/** Provided by the Checkbox Group Root and its Parent; only checkboxes read it. */
export const FORM_TOGGLE_GROUPING = new InjectionToken<Signal<FormToggleGrouping | null>>(
  "rind-ui.form-toggle-grouping",
)

/** The Root the shared parts find (each component provides its Root under this token). */
export const FORM_TOGGLE = new InjectionToken<FormToggleRoot<CheckedState, unknown>>(
  "rind-ui.form-toggle",
)

function injectFormToggle(part: string): FormToggleRoot<CheckedState, unknown> {
  const root = inject(FORM_TOGGLE, { optional: true })
  if (!root) throw new Error(`${part} must be inside its Root`)
  return root
}

/**
 * A form toggle's Root: the container, its hidden form input(s) after the content, and the
 * state the parts read. A component subclasses it as a component whose template is
 * `FORM_TOGGLE_TEMPLATE` and implements `createService`.
 */
@Directive()
export abstract class FormToggleRoot<V extends CheckedState, D> {
  /** Controlled value (`[(checked)]`). */
  readonly checked = input<V | undefined>(undefined)
  /** Read at creation; a later change only changes what a form reset restores. */
  readonly defaultChecked = input<V>(false as V)
  /** Ignores activation. In a Checkbox Group the group's `disabled` also applies. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Disabled but still in the Tab order (`aria-disabled`). */
  readonly focusableWhenDisabled = input(false, { transform: booleanAttribute })
  /** Keeps focus and value, ignores activation. */
  readonly readonly = input(false, { transform: booleanAttribute })
  /** Must be checked to submit. A Checkbox Group Parent is never required. */
  readonly required = input(false, { transform: booleanAttribute })
  /** Marks the toggle invalid (`aria-invalid`, `data-invalid`). */
  readonly invalid = input(false, { transform: booleanAttribute })
  /** The submitted field name; ignored in a Checkbox Group (the group's `name` applies). */
  readonly name = input<string>()
  /** Submitted while checked (default "on"). */
  readonly value = input("on")
  /** The id of the form the hidden input belongs to. */
  readonly form = input<string>()
  /** Submitted while unchecked (and enabled); unchecked submits nothing without it. */
  readonly uncheckedValue = input<string>()
  readonly id = input<string>()

  /** @internal */
  abstract readonly config: FormToggleConfig
  /** The component's machine: `checkedChange` / `checkedChangeDetails` are the subclass's. */
  protected abstract createService(
    props: () => FormToggleServiceProps<V, D>,
    formInput: FormInputCapability,
  ): FormToggleService
  /** Emits the change through the subclass's outputs; returns whether a listener cancelled. */
  protected abstract emitChange(checked: V, details: D): boolean

  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly grouping = inject(FORM_TOGGLE_GROUPING, { optional: true })
  /** @internal */
  readonly grouped = computed(() =>
    this.config.scope === "checkbox"
      ? (this.grouping?.()?.resolve(this.value(), {
          disabled: this.disabled(),
          readOnly: this.readonly(),
          required: this.required(),
        }) ?? null)
      : null,
  )
  /** @internal Inside a Checkbox Group: the group owns the value, the flags and the binding. */
  readonly binding: Signal<FieldControlBinding> | null
  /** @internal */
  readonly controlEl: { value: Element | null } = { value: null }
  /** @internal */
  readonly controlTag = signal("button")
  /** @internal */
  readonly registry: () => PartRegistry<"label" | "description">
  /** @internal */
  readonly service: FormToggleService
  /** @internal */
  readonly own: () => {
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly required: boolean
    readonly invalid: boolean
    readonly name: string | undefined
  }
  /** @internal */
  readonly ids: () => { control: string; label: string; description: string; hiddenInput: string }
  /** @internal */
  readonly hidden: () => { value: string; form: string | undefined; defaultChecked: CheckedState }
  /** The toggle's state, for the template (`#c="rindCheckboxRoot"`, `c.state()`). */
  readonly state: Signal<FormToggleState<V>>
  /** @internal The hidden form input's props (the template renders it). */
  protected readonly hiddenInput: Signal<PartProps>
  /** @internal The unchecked-value input's props, when there is one. */
  protected readonly uncheckedInput: Signal<PartProps | null>
  /** @internal */
  protected readonly inputRef = viewChild<ElementRef<HTMLInputElement>>("input")

  constructor() {
    const env = injectEnvironment()
    // Read when the first props apply (the inputs are set then): grouped or not.
    this.binding = injectFieldControl({ skip: untracked(this.grouping ?? (() => null)) !== null })
    const fieldsetContext = injectFieldsetDisabled()
    const fieldsetDom = signal(false)
    const field = computed(() => {
      const g = this.grouped()
      return mergeFieldProps(
        {
          role: this.config.role,
          labelable: true,
          disabled: (g?.props.disabled ?? this.disabled()) || fieldsetContext() || fieldsetDom(),
          readOnly: g?.props.readOnly ?? this.readonly(),
          required: g?.props.required ?? this.required(),
          invalid: g?.props.invalid ?? this.invalid(),
          name: g ? g.props.name : this.name(),
        },
        this.binding?.() ?? null,
      )
    })
    const inputEl = () => this.inputRef()?.nativeElement ?? null
    const formInput = hiddenFormInput(
      { input: inputEl, control: () => this.controlEl.value as HTMLElement | null },
      env,
    )
    // The reason of the latest proposal, for the Field's change report (user or reset).
    let lastReason: string | null = null
    this.service = this.createService(
      () => ({
        // A grouped checkbox is controlled by its group (its CheckedState).
        checked: this.grouped() ? (this.grouped()?.props.checked as V) : this.checked(),
        defaultChecked: this.defaultChecked(),
        onCheckedChange: (next: V, details: D) => {
          lastReason = (details as { reason?: string }).reason ?? null // ChangeDetails
          const g = this.grouped()
          if (g) {
            // The proposal's TOGGLE carries the modality (a RESET never reaches a grouped one).
            const event = (details as { event?: { modality?: Modality } }).event
            g.onChange(next, event?.modality ?? "virtual")
          }
          this.emitChange(next, details)
        },
        disabled: field().disabled,
        readOnly: field().readOnly,
      }),
      formInput,
    )
    const current = () => this.service.checked()
    this.own = () => ({
      disabled: field().disabled,
      readOnly: field().readOnly,
      required: this.grouped()?.props.required ?? this.required(),
      invalid: this.grouped()?.props.invalid ?? this.invalid(),
      name: field().name,
    })
    const ids = computed(() => ({
      control: this.binding?.().controlId ?? partId(this.config.scope, this.instance(), "control"),
      label: partId(this.config.scope, this.instance(), "label"),
      description: partId(this.config.scope, this.instance(), "description"),
      hiddenInput: partId(this.config.scope, this.instance(), "hidden-input"),
    }))
    this.ids = ids
    this.registry = injectPartRegistry<"label" | "description">(() => ({
      scope: this.config.scope,
      root: this.instance(),
    }))
    this.hidden = () => ({
      value: this.value(),
      form: this.grouped() ? this.grouped()?.props.form : this.form(),
      // A grouped item's server HTML submits its membership before hydration; its reset is the
      // group's (which re-syncs every item), so the attribute follows the group.
      defaultChecked: this.grouped()
        ? (this.grouped()?.props.checked ?? false)
        : this.defaultChecked(),
    })
    this.state = computed(() => ({
      checked: current() as V, // the service holds this component's value type
      disabled: field().disabled,
      readOnly: field().readOnly,
    }))
    // The parts read the value as CheckedState, which V extends; they never write it.
    const apiFor = injectApi(this as unknown as FormToggleRoot<CheckedState, unknown>)
    this.hiddenInput = computed(() => apiFor().hiddenInput())
    this.uncheckedInput = computed(() => apiFor().uncheckedInput())
    bindProps(
      () => ({
        ...apiFor().root(),
        ...this.grouped()?.props.root,
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      {
        owns: [
          "checked",
          "defaultchecked",
          "disabled",
          "focusablewhendisabled",
          "form",
          "id",
          "invalid",
          "name",
          "readonly",
          "required",
          "uncheckedvalue",
          "value",
        ],
      },
    )

    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // After every render: the input reflects the value (hydration, re-renders); no events.
    afterEveryRender(() => formInput.sync(mirrorOf(current()), { dispatch: false }))
    let stopTrack: (() => void) | undefined
    let unregister: (() => void) | undefined
    let ready = false
    let registeredKey: string | undefined
    const register = () => {
      const control = ids().control
      const tag = this.controlTag()
      const key = `${control}\n${tag}`
      if (key === registeredKey) return
      registeredKey = key
      unregister?.()
      unregister = this.binding?.().register(
        {
          id: control,
          labelable: tag === "button" || tag === "input",
          focus: (modality) => {
            const el = this.controlEl.value
            if (el instanceof HTMLElement) void focusSafely(el, env, "programmatic", modality)
          },
          validityElement: inputEl,
          value: () => current(),
        },
        control,
      )
    }
    afterNextRender(() => {
      ready = true
      const node = this.controlEl.value
      if (node) {
        const w = watchFieldsetDisabled(node, (d) => fieldsetDom.set(d))
        fieldsetDom.set(w.disabled)
        destroy.onDestroy(w.stop)
      }
      stopTrack = formInput.track({
        onReset: () => this.service.send({ type: "RESET" }),
        current: () => mirrorOf(current()),
        // A group answers its form's reset once, for every item.
        resetsWithForm: untracked(this.grouped) === null,
      })
      untracked(register)
    })
    // field-control: register, report each accepted toggle and reset.
    effect(() => {
      ids()
      this.controlTag()
      if (ready) untracked(register)
    })
    let reported: CheckedState | undefined
    effect(() => {
      const now = current()
      if (!ready) {
        reported = now
        return
      }
      if (reported === now) return
      reported = now
      untracked(() => {
        const user = lastReason === "TOGGLE"
        lastReason = null
        this.binding?.().report({ type: "change", value: now, user, composing: false })
        this.binding?.().report({ type: "commit" })
      })
    })
    destroy.onDestroy(() => {
      stopTrack?.()
      unregister?.()
    })
  }
}

/** A form toggle Root's template: the content, then the hidden input(s). */
export const FORM_TOGGLE_TEMPLATE = `<ng-content /><input #input [rindProps]="hiddenInput()" />@if (
    uncheckedInput(); as unchecked
  ) {<input [rindProps]="unchecked" />}`

/** The connect output for a part, with that part's interaction state. Call it in a constructor. */
function injectApi(root: FormToggleRoot<CheckedState, unknown>) {
  const env = injectEnvironment()
  const modality = injectModality(env.modality, () => root.service.focused())
  const description = injectRenderedId(root.registry, "description")
  const label = injectRenderedId(root.registry, "label")
  return (
    extra: {
      pressed?: boolean
      hovered?: boolean
      describedBy?: string | undefined
      ariaLabel?: string | undefined
      ariaLabelledBy?: string | undefined
    } = {},
  ) => {
    const labelable = root.controlTag() === "button" || root.controlTag() === "input"
    const grouped = root.grouped()
    const field = mergeFieldProps(
      {
        role: root.config.role,
        labelable,
        ...root.own(),
        describedBy: description(),
        consumerDescribedBy:
          [extra.describedBy, grouped?.props.describedBy].filter(Boolean).join(" ") || undefined,
        ariaLabel: extra.ariaLabel,
        ariaLabelledBy: extra.ariaLabelledBy,
      },
      root.binding?.() ?? null,
    )
    const hidden = root.hidden()
    return checkboxConnect(
      {
        scope: root.config.scope,
        role: root.config.role,
        indicatorPart: root.config.indicatorPart,
        instance: root.instance(),
        checked: root.service.checked(),
        tag: root.controlTag(),
        labelable,
        field,
        focusableWhenDisabled: root.focusableWhenDisabled(),
        focused: root.service.focused(),
        modality: modality(),
        pressed: extra.pressed ?? false,
        hovered: extra.hovered ?? false,
        ids: root.ids(),
        labelRendered: label() !== undefined,
        fieldData: root.binding?.().data,
        value: hidden.value,
        form: hidden.form,
        defaultChecked: hidden.defaultChecked,
        uncheckedValue: root.uncheckedValue(),
      },
      env,
    )
  }
}

/** The control: `<button rindCheckboxControl>` (any element; a button is labelable). */
@Directive()
export abstract class FormToggleControl {
  constructor() {
    const root = injectFormToggle("the Control")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    root.controlEl.value = el
    root.controlTag.set(el.tagName.toLowerCase())
    const read = (name: string) =>
      inject(new HostAttributeToken(name), { optional: true }) ?? undefined
    const consumer = {
      describedBy: read("aria-describedby"),
      ariaLabel: read("aria-label"),
      ariaLabelledBy: read("aria-labelledby"),
    }
    const disabled = () => root.own().disabled || root.binding?.().state.disabled === true
    const press = injectPress({
      env,
      // Only the activation toggles; PRESS.* drive data-pressed.
      send: (e) => {
        if (e.type === "PRESS") root.service.send({ type: "TOGGLE", modality: e.modality })
      },
      disabled,
    })
    const hover = injectHover({ env, send: () => {}, disabled })
    const apiFor = injectApi(root)
    const own = computed(() => {
      const api = apiFor({ pressed: press.pressed(), hovered: hover.hovered(), ...consumer })
      return { ...api.control(), ...root.grouped()?.props.control }
    })
    bindProps(
      () =>
        joinHandlers(
          own(),
          {
            // Enter submits the form (implicit submission); it never toggles. Before press, which
            // prevents Enter's native click; a consumer's preventDefault (its handlers run first)
            // still cancels the submission.
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
              const input = root.controlEl.value?.closest("form") ?? null
              implicitSubmit(input instanceof HTMLFormElement ? input : null)
            },
          },
          press.props,
          hover.props,
          {
            onFocusIn: (e: Event) =>
              root.service.send(focusEvent(e.currentTarget as Element, env.modality)),
            onFocusOut: () => root.service.send(blurEvent(env.modality)),
          },
        ),
      { owns: ["aria-describedby", "aria-labelledby"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() =>
      // The modality tracker must see the pointerdown that comes before focus.
      destroy.onDestroy(env.modality.subscribe(() => {})),
    )
    // Grouped: the group needs the rendered Control's id (aria-controls) and disabled flag.
    let stop: (() => void) | undefined
    let ready = false
    let key: string | undefined
    const sync = () => {
      const register = root.grouped()?.register
      const isDisabled = own()["disabled"] === true || own()["aria-disabled"] === "true"
      const next = `${register ? "y" : "n"}\n${el.id}\n${isDisabled}`
      if (next === key) return
      key = next
      stop?.()
      stop = register ? register(el.id, isDisabled) : undefined
    }
    afterNextRender(() => {
      ready = true
      sync()
    })
    effect(() => {
      root.grouped()
      own()
      if (ready) untracked(sync)
    })
    destroy.onDestroy(() => stop?.())
  }
}

/** Decorative: follows the checked state (`data-state`); draw a check or a dash with `@if`. */
@Directive()
export abstract class FormToggleIndicator {
  constructor() {
    const root = injectFormToggle("the Indicator")
    const apiFor = injectApi(root)
    bindProps(() => apiFor().indicator())
  }
}

/** The toggle's own label (outside a Field; inside one, the Field's Label names it). */
@Directive()
export abstract class FormToggleLabel {
  constructor() {
    const root = injectFormToggle("the Label")
    const env = injectEnvironment()
    injectRegisterPart(root.registry, "label", () => root.ids().label)
    const apiFor = injectApi(root)
    // An own Label inside a Field: the Field's names the control.
    const inField = root.binding !== null
    if (inField && inject(PLATFORM_ID) === "browser") {
      afterNextRender(() => warnOwnLabelInField(root.config.scope))
    }
    const interaction = labelInteraction(env, {
      target: () => root.controlEl.value,
      forwardsFocus: () => !(root.controlTag() === "button" || root.controlTag() === "input"),
      // The non-labelable fallback: focus the control and toggle it once.
      focusTarget: () => {
        const control = root.controlEl.value
        if (control instanceof HTMLElement) void focusSafely(control, env, "programmatic")
        root.service.send({ type: "TOGGLE", modality: env.modality.modality() })
      },
    })
    bindProps(
      () =>
        joinHandlers(
          {
            ...apiFor().label(),
            // Inside a Field the Field's Label names the control: this one must not as well.
            ...(inField ? { for: undefined } : {}),
          },
          interaction,
        ),
      { owns: ["for"] },
    )
  }
}

@Directive()
export abstract class FormToggleDescription {
  constructor() {
    const root = injectFormToggle("the Description")
    injectRegisterPart(root.registry, "description", () => root.ids().description)
    const apiFor = injectApi(root)
    bindProps(() => apiFor().description())
  }
}
