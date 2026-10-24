/** @jsxImportSource solid-js */
// The parts every form toggle shares (Checkbox, Switch): a button-like Control with a
// checkable role, Label/Description (control-label) and the hidden form input
// (hidden-form-input), wired to the component's own machine through `useService`.
import {
  type BlurEvent,
  blurEvent,
  type CheckedState,
  checkboxConnect,
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
  partId,
  warnOwnLabelInField,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

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

/** The machine props a component's `useService` receives (getters: read at use). */
export interface FormToggleServiceProps<V extends CheckedState, D> {
  readonly checked: V | undefined
  readonly defaultChecked: V
  readonly onCheckedChange: (checked: V, details: D) => void
  readonly disabled: boolean
  readonly readOnly: boolean
}

export interface FormToggleConfig<V extends CheckedState, D> {
  readonly scope: "checkbox" | "switch"
  readonly role: "checkbox" | "switch"
  /** The decorative part ("indicator", or the Switch's "thumb"). */
  readonly indicatorPart: "indicator" | "thumb"
  /** Names the component in errors ("Checkbox", "Switch"). */
  readonly label: string
  /** Public part names for guard messages (default `<label>.<Part>`). */
  readonly partNames?: Partial<
    Record<"Root" | "Control" | "Indicator" | "Label" | "Description", string>
  >
  /** The component's own machine (useMachine), in a component. */
  readonly useService: (
    props: () => FormToggleServiceProps<V, D>,
    formInput: FormInputCapability,
  ) => FormToggleService
}

interface Ctx {
  readonly config: FormToggleConfig<CheckedState, unknown>
  readonly instance: Accessor<string>
  readonly service: FormToggleService
  readonly binding: ReturnType<typeof useFieldControl>
  readonly own: Accessor<{
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly required: boolean
    readonly invalid: boolean
    readonly name: string | undefined
  }>
  readonly focusableWhenDisabled: Accessor<boolean>
  readonly ids: Accessor<{
    control: string
    label: string
    description: string
    hiddenInput: string
  }>
  readonly registry: PartRegistry<"label" | "description">
  readonly controlEl: Accessor<Element | null>
  readonly setControlEl: (el: Element | null) => void
  readonly inputEl: Accessor<HTMLInputElement | null>
  readonly controlTag: Accessor<string>
  readonly setControlTag: (tag: string) => void
  readonly hidden: Accessor<{
    value: string
    form: string | undefined
    defaultChecked: CheckedState
  }>
  readonly uncheckedValue: Accessor<string | undefined>
  /** Driven by a group (an item, or the group's select-all Parent). */
  readonly grouped: Accessor<FormToggleGrouped | null>
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

/** Provided by CheckboxGroup.Root and its Parent; only checkboxes read it. */
export const FormToggleGroupingContext = createContext<Accessor<FormToggleGrouping | null> | null>(
  null,
)

const FormToggleContext = createContext<Ctx>()
function useFormToggle(part: string, root: string): Ctx {
  const ctx = useContext(FormToggleContext)
  if (!ctx) throw new Error(`${part} must be inside ${root}`)
  return ctx
}

interface ApiExtra {
  pressed?: boolean
  hovered?: boolean
  describedBy?: string | undefined
  ariaLabel?: string | undefined
  ariaLabelledBy?: string | undefined
}

/** The connect output for a part, with that part's interaction state. Call in a component. */
function useApi(ctx: Ctx) {
  const env = useEnvironment()
  const modality = useModality(env.modality, ctx.service.focused)
  const description = useRenderedId(ctx.registry, "description")
  const label = useRenderedId(ctx.registry, "label")
  return (extra: ApiExtra = {}) => {
    const labelable = ctx.controlTag() === "button" || ctx.controlTag() === "input"
    const grouped = ctx.grouped()
    const field = mergeFieldProps(
      {
        role: ctx.config.role,
        labelable,
        ...ctx.own(),
        describedBy: description(),
        consumerDescribedBy:
          [extra.describedBy, grouped?.props.describedBy].filter(Boolean).join(" ") || undefined,
        ariaLabel: extra.ariaLabel,
        ariaLabelledBy: extra.ariaLabelledBy,
      },
      ctx.binding?.() ?? null,
    )
    const hidden = ctx.hidden()
    return checkboxConnect(
      {
        scope: ctx.config.scope,
        role: ctx.config.role,
        indicatorPart: ctx.config.indicatorPart,
        instance: ctx.instance(),
        checked: ctx.service.checked(),
        tag: ctx.controlTag(),
        labelable,
        field,
        focusableWhenDisabled: ctx.focusableWhenDisabled(),
        focused: ctx.service.focused(),
        modality: modality(),
        pressed: extra.pressed ?? false,
        hovered: extra.hovered ?? false,
        ids: ctx.ids(),
        labelRendered: label() !== undefined,
        fieldData: ctx.binding?.().data,
        value: hidden.value,
        form: hidden.form,
        defaultChecked: hidden.defaultChecked,
        uncheckedValue: ctx.uncheckedValue(),
      },
      env,
    )
  }
}

export type FormToggleRootProps<V extends CheckedState, D> = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "id"
> & {
  /** The toggle parts (Control, Label, Description). */
  readonly children?: JSX.Element | ((state: FormToggleState<V>) => JSX.Element)
  /** Controlled value. */
  readonly checked?: V | undefined
  /** Read at creation; a later change only changes what a form reset restores. */
  readonly defaultChecked?: V | undefined
  /** Every user-caused change (toggle or form reset); never called for a parent change. */
  readonly onCheckedChange?: ((checked: V, details: D) => void) | undefined
  /**
   * Ignores activation. In a Checkbox Group the group's `disabled` also applies; a Parent
   * follows only the group's.
   */
  readonly disabled?: boolean | undefined
  /** Disabled but still in the Tab order (`aria-disabled`). */
  readonly focusableWhenDisabled?: boolean | undefined
  /**
   * Keeps focus and value, ignores activation. In a Checkbox Group the group's `readOnly` also
   * applies; a Parent follows only the group's.
   */
  readonly readOnly?: boolean | undefined
  /** Must be checked to submit. A Checkbox Group Parent is never required. */
  readonly required?: boolean | undefined
  /** Marks the toggle invalid (`aria-invalid`, `data-invalid`). */
  readonly invalid?: boolean | undefined
  /** The submitted field name; ignored in a Checkbox Group (the group's `name` applies). */
  readonly name?: string | undefined
  /** Submitted while checked (default "on"). */
  readonly value?: string | undefined
  /**
   * The id of the form the hidden input belongs to; ignored in a Checkbox Group (the group's
   * `form` applies).
   */
  readonly form?: string | undefined
  /** Submitted while unchecked (and enabled); unchecked submits nothing without it. */
  readonly uncheckedValue?: string | undefined
  readonly id?: string | undefined
  /** Another element or a render function receiving the props and the toggle's state. */
  readonly render?: RenderProp<FormToggleState<V>> | undefined
}

export type FormToggleIndicatorProps<V extends CheckedState = CheckedState> = Omit<
  JSX.HTMLAttributes<HTMLSpanElement>,
  "children"
> & {
  /** Content, or a function of the state (draw a check or a dash). */
  readonly children?:
    | JSX.Element
    | ((state: { checked: boolean; indeterminate: boolean }) => JSX.Element)
  /** Another element or a render function receiving the props and the toggle's state. */
  readonly render?: RenderProp<FormToggleState<V>> | undefined
}

/** The parts of one form toggle component, wired to its machine. */
/* @__NO_SIDE_EFFECTS__ */
export function createFormToggle<V extends CheckedState, D>(config: FormToggleConfig<V, D>) {
  // The shared parts read the service through CheckedState; V narrows it per component.
  const shared = config as unknown as FormToggleConfig<CheckedState, unknown>
  const partName = (part: "Root" | "Control" | "Indicator" | "Label" | "Description") =>
    config.partNames?.[part] ?? `${config.label}.${part}`

  function Root(props: FormToggleRootProps<V, D>) {
    const [local, rest] = splitProps(props, [
      "checked",
      "defaultChecked",
      "onCheckedChange",
      "disabled",
      "focusableWhenDisabled",
      "readOnly",
      "required",
      "invalid",
      "name",
      "value",
      "form",
      "uncheckedValue",
      "render",
      "id",
      "children",
    ])
    const env = useEnvironment()
    const instance = useRootId(() => local.id)
    const value = () => local.value ?? "on"
    // Inside a Checkbox Group: the group owns the value, the flags and the Field binding.
    const grouping = useContext(FormToggleGroupingContext)
    const grouped = createMemo(() =>
      config.scope === "checkbox"
        ? (grouping?.()?.resolve(value(), {
            disabled: local.disabled === true,
            readOnly: local.readOnly === true,
            required: local.required === true,
          }) ?? null)
        : null,
    )
    const binding = useFieldControl({ skip: untrack(grouped) !== null })
    const [controlEl, setControlEl] = createSignal<Element | null>(null)
    const [inputEl, setInputEl] = createSignal<HTMLInputElement | null>(null)
    const [controlTag, setControlTag] = createSignal("button")
    // A rind-ui Fieldset's context reaches portalled parts; the DOM tracker native fieldsets.
    const fieldsetContext = useFieldsetDisabled()
    const [fieldsetDom, setFieldsetDom] = createSignal(false)
    const field = createMemo(() => {
      const g = grouped()
      return mergeFieldProps(
        {
          role: config.role,
          labelable: true,
          disabled:
            (g?.props.disabled ?? local.disabled === true) || fieldsetContext() || fieldsetDom(),
          readOnly: g?.props.readOnly ?? local.readOnly === true,
          required: g?.props.required ?? local.required === true,
          invalid: g?.props.invalid ?? local.invalid === true,
          name: g ? g.props.name : local.name,
        },
        binding?.() ?? null,
      )
    })
    const formInput = hiddenFormInput(
      { input: () => inputEl(), control: () => controlEl() as HTMLElement | null },
      env,
    )
    // The reason of the latest proposal, for the Field's change report (user or reset).
    let lastReason: string | null = null
    const service = config.useService(
      () => ({
        // A grouped checkbox is controlled by its group (its CheckedState).
        checked: grouped() ? (grouped()?.props.checked as V) : local.checked,
        defaultChecked: (local.defaultChecked ?? false) as V,
        onCheckedChange: (next: V, details: D) => {
          lastReason = (details as { reason?: string }).reason ?? null // ChangeDetails
          const g = grouped()
          if (g) {
            // The proposal's TOGGLE carries the modality (a RESET never reaches a grouped one).
            const event = (details as { event?: { modality?: Modality } }).event
            g.onChange(next, event?.modality ?? "virtual")
          }
          local.onCheckedChange?.(next, details)
        },
        disabled: field().disabled,
        readOnly: field().readOnly,
      }),
      formInput,
    )
    const current = () => service.checked()
    const isGrouped = createMemo(() => grouped() !== null)
    // The input reflects the value (hydration, updates); no events.
    afterMount(() => {
      createEffect(() => {
        inputEl()
        formInput.sync(mirrorOf(current()), { dispatch: false })
      })
      const node = controlEl()
      if (node) {
        const w = watchFieldsetDisabled(node, setFieldsetDom)
        setFieldsetDom(w.disabled)
        onCleanup(w.stop)
      }
      createEffect(() => {
        const group = isGrouped()
        onCleanup(
          formInput.track({
            onReset: () => service.send({ type: "RESET" }),
            current: () => mirrorOf(untrack(current)),
            // A group answers its form's reset once, for every item.
            resetsWithForm: !group,
          }),
        )
      })
    })
    // A memo: the binding changes on every registration, the id (compared by value) does not.
    const controlId = createMemo(
      () => binding?.().controlId ?? partId(config.scope, instance(), "control"),
    )
    const ids = createMemo(() => ({
      control: controlId(),
      label: partId(config.scope, instance(), "label"),
      description: partId(config.scope, instance(), "description"),
      hiddenInput: partId(config.scope, instance(), "hidden-input"),
    }))
    afterMount(() => {
      // field-control: register, report each accepted toggle and reset.
      createEffect(() => {
        const control = controlId()
        const tag = controlTag()
        const off = untrack(() =>
          binding?.().register(
            {
              id: control,
              labelable: tag === "button" || tag === "input",
              focus: (modality) => {
                const el = controlEl()
                if (el instanceof HTMLElement) void focusSafely(el, env, "programmatic", modality)
              },
              validityElement: () => inputEl(),
              value: () => untrack(current),
            },
            control,
          ),
        )
        if (off) onCleanup(off)
      })
      createEffect(
        on(
          current,
          (now) => {
            const user = lastReason === "TOGGLE"
            lastReason = null
            untrack(() => {
              binding?.().report({ type: "change", value: now, user, composing: false })
              binding?.().report({ type: "commit" })
            })
          },
          { defer: true },
        ),
      )
    })
    const registry = usePartRegistry<"label" | "description">({
      scope: config.scope,
      root: instance(),
    })
    const ctx: Ctx = {
      config: shared,
      instance,
      service,
      binding,
      own: () => ({
        disabled: field().disabled,
        readOnly: field().readOnly,
        required: grouped()?.props.required ?? local.required === true,
        invalid: grouped()?.props.invalid ?? local.invalid === true,
        name: field().name,
      }),
      focusableWhenDisabled: () => local.focusableWhenDisabled === true,
      ids,
      registry,
      controlEl,
      setControlEl,
      inputEl,
      controlTag,
      setControlTag,
      hidden: () => ({
        value: value(),
        form: grouped() ? grouped()?.props.form : local.form,
        // A grouped item's server HTML submits its membership before hydration; its reset is
        // the group's (which re-syncs every item), so the attribute follows the group.
        defaultChecked: grouped()
          ? (grouped()?.props.checked as CheckedState)
          : (local.defaultChecked ?? false),
      }),
      uncheckedValue: () => local.uncheckedValue,
      grouped,
    }
    const apiFor = useApi(ctx)
    const api = createMemo(() => apiFor())
    const merged = createMemo(() =>
      mergeProps(
        {
          ...normalizeProps({ ...api().root(), ...grouped()?.props.root }),
          ...(local.id === undefined ? {} : { id: local.id }),
        },
        rest,
      ),
    )
    const state = reactive<FormToggleState<V>>(() => ({
      checked: current() as V, // the service holds this component's value type
      disabled: field().disabled,
      readOnly: field().readOnly,
    }))
    const unchecked = () => api().uncheckedInput()
    const children = (): JSX.Element => (
      <>
        {resolveChildren(local.children, state)}
        {/* After the control: never a wrapping label's first labelable descendant. */}
        <input {...normalizeProps(api().hiddenInput())} ref={setInputEl} />
        <Show when={unchecked()}>{(u) => <input {...normalizeProps(u())} />}</Show>
      </>
    )
    return (
      <FormToggleContext.Provider value={ctx}>
        {renderPart(local.render, merged, state, children, (p) => (
          <div {...p}>{children()}</div>
        ))}
      </FormToggleContext.Provider>
    )
  }

  type PartProps<A> = Omit<A, "children"> & {
    /** Another element or a render function receiving the props and the toggle's state. */
    readonly render?: RenderProp<FormToggleState<V>> | undefined
    readonly children?: JSX.Element | ((state: FormToggleState<V>) => JSX.Element)
  }

  function stateOf(ctx: Ctx, api: Accessor<ReturnType<ReturnType<typeof useApi>>>) {
    return reactive<FormToggleState<V>>(() => {
      const root = api().root()
      return {
        checked: ctx.service.checked() as V, // the service holds this component's value type
        disabled: root["data-disabled"] !== undefined,
        readOnly: root["data-readonly"] !== undefined,
      }
    })
  }

  function Control(props: PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
    const [local, rest] = splitProps(props, [
      "render",
      "children",
      "aria-describedby",
      "aria-label",
      "aria-labelledby",
    ])
    const ctx = useFormToggle(partName("Control"), partName("Root"))
    const env = useEnvironment()
    // The modality tracker must see the pointerdown that comes before focus.
    afterMount(() => onCleanup(env.modality.subscribe(() => {})))
    const [el, setEl] = createSignal<Element | null>(null)
    afterMount(() => createEffect(() => ctx.setControlTag(el()?.tagName.toLowerCase() ?? "button")))
    const disabled = () => ctx.own().disabled || ctx.binding?.().state.disabled === true
    const press = usePress({
      env,
      // Only the activation toggles; PRESS.* drive data-pressed.
      send: (e) => {
        if (e.type === "PRESS") ctx.service.send({ type: "TOGGLE", modality: e.modality })
      },
      disabled,
    })
    const hover = useHover({ env, send: () => {}, disabled })
    const apiFor = useApi(ctx)
    const api = createMemo(() =>
      apiFor({
        pressed: press.pressed(),
        hovered: hover.hovered(),
        describedBy: local["aria-describedby"],
        ariaLabel: local["aria-label"],
        ariaLabelledBy: local["aria-labelledby"],
      }),
    )
    const own = createMemo(() =>
      normalizeProps({ ...api().control(), ...ctx.grouped()?.props.control }),
    )
    // Grouped: the group needs the rendered Control's id (aria-controls) and disabled flag.
    // Primitive sources: re-registered only when one of them changes.
    const groupRegister = createMemo(() => ctx.grouped()?.register)
    const controlDisabled = createMemo(
      () => own()["disabled"] === true || own()["aria-disabled"] === "true",
    )
    afterMount(() =>
      createEffect(() => {
        const register = groupRegister()
        const node = el()
        const isDisabled = controlDisabled()
        if (register && node) onCleanup(untrack(() => register(node.id, isDisabled)))
      }),
    )
    const merged = createMemo(() =>
      mergeProps(
        {
          ...joinHandlers(
            own(),
            {
              // Enter submits the form (implicit submission); it never toggles. Before press,
              // which prevents Enter's native click; a consumer's preventDefault (its
              // handlers run first) still cancels the submission.
              onKeyDown: (e: KeyboardEvent) => {
                if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
                implicitSubmit(ctx.inputEl()?.form ?? null)
              },
            },
            press.props,
            hover.props,
            {
              onFocusIn: (e: { currentTarget: Element }) =>
                ctx.service.send(focusEvent(e.currentTarget, env.modality)),
              onFocusOut: () => ctx.service.send(blurEvent(env.modality)),
            },
          ),
          ...(local["aria-label"] === undefined ? {} : { "aria-label": local["aria-label"] }),
          ref: (node: Element) => {
            setEl(node)
            ctx.setControlEl(node)
          },
        },
        rest,
      ),
    )
    const state = stateOf(ctx, api)
    const children = () => resolveChildren(local.children, state)
    return renderPart(local.render, merged, state, children, (p) => (
      <button {...p}>{children()}</button>
    ))
  }

  function Indicator(props: FormToggleIndicatorProps<V>) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useFormToggle(
      config.indicatorPart === "thumb" ? `${config.label}.Thumb` : partName("Indicator"),
      partName("Root"),
    )
    const apiFor = useApi(ctx)
    const api = createMemo(() => apiFor())
    const merged = createMemo(() => mergeProps(normalizeProps(api().indicator()), rest))
    const shape = reactive(() => {
      const value = ctx.service.checked()
      return { checked: value === true, indeterminate: value === "indeterminate" }
    })
    const children = () => resolveChildren(local.children, shape)
    const state = stateOf(ctx, api)
    return renderPart(local.render, merged, state, children, (p) => (
      <span {...p}>{children()}</span>
    ))
  }

  function Label(props: PartProps<JSX.LabelHTMLAttributes<HTMLLabelElement>>) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useFormToggle(partName("Label"), partName("Root"))
    const env = useEnvironment()
    useRegisterPart(ctx.registry, "label", () => ctx.ids().label)
    const apiFor = useApi(ctx)
    const api = createMemo(() => apiFor())
    // An own Label inside a Field: the Field's names the control.
    const inField = ctx.binding !== null
    afterMount(() => {
      if (inField) warnOwnLabelInField(config.scope)
    })
    const interaction = normalizeProps(
      labelInteraction(env, {
        target: () => ctx.controlEl(),
        forwardsFocus: () => !(ctx.controlTag() === "button" || ctx.controlTag() === "input"),
        // The non-labelable fallback: focus the control and toggle it once.
        focusTarget: () => {
          const control = ctx.controlEl()
          if (control instanceof HTMLElement) void focusSafely(control, env, "programmatic")
          ctx.service.send({ type: "TOGGLE", modality: env.modality.modality() })
        },
      }),
    )
    const merged = createMemo(() =>
      mergeProps(
        {
          ...normalizeProps(api().label()),
          // Inside a Field the Field's Label names the control: this one must not as well.
          ...(inField ? { for: undefined } : {}),
          ...interaction,
        },
        rest,
      ),
    )
    const state = stateOf(ctx, api)
    const children = () => resolveChildren(local.children, state)
    return renderPart(local.render, merged, state, children, (p) => (
      // biome-ignore lint/a11y/noLabelWithoutControl: `for` names the Control
      <label {...p}>{children()}</label>
    ))
  }

  function Description(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useFormToggle(partName("Description"), partName("Root"))
    useRegisterPart(ctx.registry, "description", () => ctx.ids().description)
    const apiFor = useApi(ctx)
    const api = createMemo(() => apiFor())
    const merged = createMemo(() => mergeProps(normalizeProps(api().description()), rest))
    const state = stateOf(ctx, api)
    const children = () => resolveChildren(local.children, state)
    return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
  }

  return { Root, Control, Indicator, Label, Description }
}
