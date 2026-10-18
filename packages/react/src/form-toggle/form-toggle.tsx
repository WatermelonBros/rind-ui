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
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useFieldControl } from "../field/field"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

const mirrorOf = (v: CheckedState) => ({
  checked: v === true,
  indeterminate: v === "indeterminate",
})

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

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
  readonly checked: CheckedState
  readonly focused: boolean
  send(event: FormToggleEvent): void
}

/** The machine props a component's `useService` receives. */
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
  /** A hook: the component's own machine (useMachine). */
  readonly useService: (
    props: FormToggleServiceProps<V, D>,
    formInput: FormInputCapability,
  ) => FormToggleService
}

interface Ctx {
  readonly config: FormToggleConfig<CheckedState, unknown>
  readonly instance: string
  readonly service: FormToggleService
  readonly binding: ReturnType<typeof useFieldControl>
  readonly own: {
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly required: boolean
    readonly invalid: boolean
    readonly name: string | undefined
  }
  readonly focusableWhenDisabled: boolean
  readonly ids: { control: string; label: string; description: string; hiddenInput: string }
  readonly registry: ReturnType<typeof usePartRegistry<"label" | "description">>
  readonly controlEl: { current: HTMLElement | null }
  readonly inputEl: { current: HTMLInputElement | null }
  readonly controlTag: string
  readonly setControlTag: (tag: string) => void
  readonly hidden: { value: string; form: string | undefined; defaultChecked: CheckedState }
  readonly uncheckedValue: string | undefined
  /** Driven by a group (an item, or the group's select-all Parent). */
  readonly grouped: FormToggleGrouped | null
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
export const FormToggleGroupingContext = createContext<FormToggleGrouping | null>(null)

const FormToggleContext = createContext<Ctx | null>(null)
function useFormToggle(part: string, root: string): Ctx {
  const ctx = useContext(FormToggleContext)
  if (!ctx) throw new Error(`${part} must be inside ${root}`)
  return ctx
}

/** The connect output for a part, with that part's interaction state. */
function useApi(
  ctx: Ctx,
  extra: {
    focused?: boolean
    pressed?: boolean
    hovered?: boolean
    describedBy?: string | undefined
    ariaLabel?: string | undefined
    ariaLabelledBy?: string | undefined
  } = {},
) {
  const env = useEnvironment()
  const modality = useModality(env.modality, ctx.service.focused)
  const description = useRenderedId(ctx.registry, "description")
  const label = useRenderedId(ctx.registry, "label")
  const labelable = ctx.controlTag === "button" || ctx.controlTag === "input"
  const field = mergeFieldProps(
    {
      role: ctx.config.role,
      labelable,
      ...ctx.own,
      describedBy: description,
      consumerDescribedBy:
        [extra.describedBy, ctx.grouped?.props.describedBy].filter(Boolean).join(" ") || undefined,
      ariaLabel: extra.ariaLabel,
      ariaLabelledBy: extra.ariaLabelledBy,
    },
    ctx.binding,
  )
  return checkboxConnect(
    {
      scope: ctx.config.scope,
      role: ctx.config.role,
      indicatorPart: ctx.config.indicatorPart,
      instance: ctx.instance,
      checked: ctx.service.checked,
      tag: ctx.controlTag,
      labelable,
      field,
      focusableWhenDisabled: ctx.focusableWhenDisabled,
      focused: ctx.service.focused,
      modality,
      pressed: extra.pressed ?? false,
      hovered: extra.hovered ?? false,
      ids: ctx.ids,
      labelRendered: label !== undefined,
      fieldData: ctx.binding?.data,
      value: ctx.hidden.value,
      form: ctx.hidden.form,
      defaultChecked: ctx.hidden.defaultChecked,
      uncheckedValue: ctx.uncheckedValue,
    },
    env,
  )
}

export type FormToggleRootProps<V extends CheckedState, D> = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultChecked"
> & {
  /** The toggle parts (Control, Label, Description). */
  readonly children?: ReactNode
  /** Controlled value. */
  readonly checked?: V
  /** Read at creation; a later change only changes what a form reset restores. */
  readonly defaultChecked?: V
  /** Every user-caused change (toggle or form reset); never called for a parent change. */
  readonly onCheckedChange?: (checked: V, details: D) => void
  /**
   * Ignores activation. In a Checkbox Group the group's `disabled` also applies; a Parent
   * follows only the group's.
   */
  readonly disabled?: boolean
  /** Disabled but still in the Tab order (`aria-disabled`). */
  readonly focusableWhenDisabled?: boolean
  /**
   * Keeps focus and value, ignores activation. In a Checkbox Group the group's `readOnly` also
   * applies; a Parent follows only the group's.
   */
  readonly readOnly?: boolean
  /** Must be checked to submit. A Checkbox Group Parent is never required. */
  readonly required?: boolean
  /** Marks the toggle invalid (`aria-invalid`, `data-invalid`). */
  readonly invalid?: boolean
  /** The submitted field name; ignored in a Checkbox Group (the group's `name` applies). */
  readonly name?: string
  /** Submitted while checked (default "on"). */
  readonly value?: string
  /**
   * The id of the form the hidden input belongs to; ignored in a Checkbox Group (the group's
   * `form` applies).
   */
  readonly form?: string
  /** Submitted while unchecked (and enabled); unchecked submits nothing without it. */
  readonly uncheckedValue?: string
  /** Another element or a render function receiving the props and the toggle's state. */
  readonly render?: RenderProp<FormToggleState<V>>
}

/** The parts of one form toggle component, wired to its machine. */
export function createFormToggle<V extends CheckedState, D>(config: FormToggleConfig<V, D>) {
  // The shared parts read the service through CheckedState; V narrows it per component.
  const shared = config as unknown as FormToggleConfig<CheckedState, unknown>
  const partName = (part: "Root" | "Control" | "Indicator" | "Label" | "Description") =>
    config.partNames?.[part] ?? `${config.label}.${part}`
  function Root({
    checked,
    defaultChecked = false as V,
    onCheckedChange,
    disabled = false,
    focusableWhenDisabled = false,
    readOnly = false,
    required = false,
    invalid = false,
    name,
    value = "on",
    form,
    uncheckedValue,
    render,
    id,
    ref,
    children,
    ...rest
  }: FormToggleRootProps<V, D>) {
    const env = useEnvironment()
    const instance = useRootId(id)
    // Inside a Checkbox Group: the group owns the value, the flags and the Field binding.
    const grouping = useContext(FormToggleGroupingContext)
    const grouped =
      config.scope === "checkbox"
        ? (grouping?.resolve(value, { disabled, readOnly, required }) ?? null)
        : null
    const binding = useFieldControl({ skip: grouped !== null })
    const controlEl = useRef<HTMLElement | null>(null)
    const inputEl = useRef<HTMLInputElement | null>(null)
    const [controlTag, setControlTag] = useState("button")
    // A rind-ui Fieldset's context reaches portalled parts; the DOM tracker native fieldsets.
    const fieldsetContext = useFieldsetDisabled()
    const [fieldsetDom, setFieldsetDom] = useState(false)
    const field = mergeFieldProps(
      {
        role: config.role,
        labelable: true,
        disabled: (grouped?.props.disabled ?? disabled) || fieldsetContext || fieldsetDom,
        readOnly: grouped?.props.readOnly ?? readOnly,
        required: grouped?.props.required ?? required,
        invalid: grouped?.props.invalid ?? invalid,
        name: grouped ? grouped.props.name : name,
      },
      binding,
    )
    const formInput = useMemo(
      () =>
        hiddenFormInput({ input: () => inputEl.current, control: () => controlEl.current }, env),
      [env],
    )
    // The reason of the latest proposal, for the Field's change report (user or reset).
    const lastReason = useRef<string | null>(null)
    const service = config.useService(
      {
        // A grouped checkbox is controlled by its group (its CheckedState).
        checked: grouped ? (grouped.props.checked as V) : checked,
        defaultChecked,
        onCheckedChange: (next, details) => {
          lastReason.current = (details as { reason?: string }).reason ?? null // ChangeDetails
          if (grouped) {
            // The proposal's TOGGLE carries the modality (a RESET never reaches a grouped one).
            const event = (details as { event?: { modality?: Modality } }).event
            grouped.onChange(next, event?.modality ?? "virtual")
          }
          onCheckedChange?.(next, details)
        },
        disabled: field.disabled,
        readOnly: field.readOnly,
      },
      formInput,
    )
    const { send } = service
    const current = service.checked
    // After every commit: the input reflects the value (hydration, re-renders); no events.
    const isGrouped = grouped !== null
    const latest = useRef(current)
    latest.current = current
    useIsoLayoutEffect(() => {
      formInput.sync(mirrorOf(latest.current), { dispatch: false })
    })
    useEffect(
      () =>
        formInput.track({
          onReset: () => send({ type: "RESET" }),
          current: () => mirrorOf(latest.current),
          // A group answers its form's reset once, for every item.
          resetsWithForm: !isGrouped,
        }),
      [formInput, send, isGrouped],
    )
    useEffect(() => {
      const node = controlEl.current
      if (!node) return
      const watch = watchFieldsetDisabled(node, setFieldsetDom)
      setFieldsetDom(watch.disabled)
      return watch.stop
    }, [])
    const ids = {
      control: binding?.controlId ?? partId(config.scope, instance, "control"),
      label: partId(config.scope, instance, "label"),
      description: partId(config.scope, instance, "description"),
      hiddenInput: partId(config.scope, instance, "hidden-input"),
    }
    // field-control: register once, report each accepted toggle and reset.
    const register = binding?.register
    useIsoLayoutEffect(() => {
      if (!register) return
      return register(
        {
          id: ids.control,
          labelable: controlTag === "button" || controlTag === "input",
          focus: (modality) => {
            if (controlEl.current)
              void focusSafely(controlEl.current, env, "programmatic", modality)
          },
          validityElement: () => inputEl.current,
          value: () => latest.current,
        },
        ids.control,
      )
    }, [register, ids.control, controlTag, env])
    const reported = useRef(current)
    const report = binding?.report
    useEffect(() => {
      if (reported.current === current) return
      reported.current = current
      const user = lastReason.current === "TOGGLE"
      lastReason.current = null
      report?.({ type: "change", value: current, user, composing: false })
      report?.({ type: "commit" })
    }, [current, report])
    const registry = usePartRegistry<"label" | "description">({
      scope: config.scope,
      root: instance,
    })
    const ctx: Ctx = {
      config: shared,
      instance,
      service,
      binding,
      own: {
        disabled: field.disabled,
        readOnly: field.readOnly,
        required: grouped?.props.required ?? required,
        invalid: grouped?.props.invalid ?? invalid,
        name: field.name,
      },
      focusableWhenDisabled,
      ids,
      registry,
      controlEl,
      inputEl,
      controlTag,
      setControlTag,
      hidden: {
        value,
        form: grouped ? grouped.props.form : form,
        // A grouped item's server HTML submits its membership before hydration; its reset
        // is the group's (which re-syncs every item), so the attribute follows the group.
        defaultChecked: grouped ? grouped.props.checked : defaultChecked,
      },
      uncheckedValue,
      grouped,
    }
    const api = useApi(ctx)
    const props = mergeProps(
      {
        ...normalizeProps({ ...api.root(), ...grouped?.props.root }),
        ...(id === undefined ? {} : { id }),
        ref,
      },
      rest,
    )
    const unchecked = api.uncheckedInput()
    const state: FormToggleState<V> = {
      checked: current as V, // the service holds this component's value type
      disabled: field.disabled,
      readOnly: field.readOnly,
    }
    return (
      <FormToggleContext value={ctx}>
        {renderPart(
          "div",
          {
            ...props,
            children: (
              <>
                {children}
                {/* After the control: never a wrapping label's first labelable descendant. */}
                <input {...normalizeProps(api.hiddenInput())} ref={inputEl} />
                {unchecked && <input {...normalizeProps(unchecked)} />}
              </>
            ),
          },
          render,
          state,
        )}
      </FormToggleContext>
    )
  }

  type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
    /** Another element or a render function receiving the props and the toggle's state. */
    readonly render?: RenderProp<FormToggleState<V>>
  }

  function stateOf(ctx: Ctx, api: ReturnType<typeof useApi>): FormToggleState<V> {
    const root = api.root()
    return {
      checked: ctx.service.checked as V, // the service holds this component's value type
      disabled: root["data-disabled"] !== undefined,
      readOnly: root["data-readonly"] !== undefined,
    }
  }

  function Control({
    render,
    ref,
    "aria-describedby": describedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...rest
  }: PartProps<"button">) {
    const ctx = useFormToggle(partName("Control"), partName("Root"))
    const env = useEnvironment()
    // The modality tracker must see the pointerdown that comes before focus.
    useEffect(() => env.modality.subscribe(() => {}), [env])
    const el = useRef<HTMLElement | null>(null)
    const tag = useRenderedTag("button", render, el)
    const { setControlTag } = ctx
    useIsoLayoutEffect(() => setControlTag(tag), [tag, setControlTag])
    const disabled = () => ctx.own.disabled || ctx.binding?.state.disabled === true
    const press = usePress({
      env,
      // Only the activation toggles; PRESS.* drive data-pressed.
      send: (e) => {
        if (e.type === "PRESS") ctx.service.send({ type: "TOGGLE", modality: e.modality })
      },
      disabled,
    })
    const hover = useHover({ env, send: () => {}, disabled })
    const api = useApi(ctx, {
      pressed: press.pressed,
      hovered: hover.hovered,
      describedBy,
      ariaLabel,
      ariaLabelledBy,
    })
    const own = normalizeProps({ ...api.control(), ...ctx.grouped?.props.control })
    // Grouped: the group needs the rendered Control's id (aria-controls) and disabled flag.
    const groupRegister = ctx.grouped?.register
    const controlDisabled = own["disabled"] === true || own["aria-disabled"] === "true"
    useIsoLayoutEffect(() => {
      const node = el.current
      if (!groupRegister || !node) return
      return groupRegister(node.id, controlDisabled)
    }, [groupRegister, controlDisabled])
    const props = mergeProps(
      {
        ...joinHandlers(
          own,
          {
            // Enter submits the form (implicit submission); it never toggles. Before press.ts,
            // which prevents Enter's native click; a consumer's preventDefault (its handlers
            // run first) still cancels the submission.
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
              implicitSubmit(ctx.inputEl.current?.form ?? null)
            },
          },
          press.props,
          hover.props,
          {
            onFocus: (e: { currentTarget: Element }) =>
              ctx.service.send(focusEvent(e.currentTarget, env.modality)),
            onBlur: () => ctx.service.send(blurEvent(env.modality)),
          },
        ),
        ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel }),
        ref: composeRefs(composeRefs(el, ctx.controlEl), ref),
      },
      rest,
    )
    return renderPart("button", props, render, stateOf(ctx, api))
  }

  function Indicator({ render, children, ...rest }: FormToggleIndicatorProps<V>) {
    const ctx = useFormToggle(
      config.indicatorPart === "thumb" ? `${config.label}.Thumb` : partName("Indicator"),
      partName("Root"),
    )
    const api = useApi(ctx)
    const value = ctx.service.checked
    const content =
      typeof children === "function"
        ? children({ checked: value === true, indeterminate: value === "indeterminate" })
        : children
    const props = mergeProps(normalizeProps(api.indicator()), rest)
    return renderPart("span", { ...props, children: content }, render, stateOf(ctx, api))
  }

  function Label({ render, ref, ...rest }: PartProps<"label">) {
    const ctx = useFormToggle(partName("Label"), partName("Root"))
    const env = useEnvironment()
    useRegisterPart(ctx.registry, "label", ctx.ids.label)
    const api = useApi(ctx)
    const labelable = ctx.controlTag === "button" || ctx.controlTag === "input"
    // An own Label inside a Field: the Field's names the control.
    const inField = ctx.binding !== null
    useEffect(() => {
      if (inField) warnOwnLabelInField(config.scope)
    }, [inField])
    const interaction = labelInteraction(env, {
      target: () => ctx.controlEl.current,
      forwardsFocus: () => !labelable,
      // The non-labelable fallback: focus the control and toggle it once.
      focusTarget: () => {
        const control = ctx.controlEl.current
        if (control) void focusSafely(control, env, "programmatic")
        ctx.service.send({ type: "TOGGLE", modality: env.modality.modality() })
      },
    })
    const props = mergeProps(
      {
        ...normalizeProps(api.label()),
        // Inside a Field the Field's Label names the control: this one must not as well.
        ...(inField ? { htmlFor: undefined } : {}),
        ...interaction,
        ref,
      },
      rest,
    )
    return renderPart("label", props, render, stateOf(ctx, api))
  }

  function Description({ render, ...rest }: PartProps<"div">) {
    const ctx = useFormToggle(partName("Description"), partName("Root"))
    useRegisterPart(ctx.registry, "description", ctx.ids.description)
    const api = useApi(ctx)
    const props = mergeProps(normalizeProps(api.description()), rest)
    return renderPart("div", props, render, stateOf(ctx, api))
  }

  return { Root, Control, Indicator, Label, Description }
}

export type FormToggleIndicatorProps<V extends CheckedState = CheckedState> = Omit<
  ComponentPropsWithRef<"span">,
  "children"
> & {
  /** Content, or a function of the state (draw a check or a dash). */
  readonly children?:
    | ReactNode
    | ((state: { checked: boolean; indeterminate: boolean }) => ReactNode)
  /** Another element or a render function receiving the props and the toggle's state. */
  readonly render?: RenderProp<FormToggleState<V>>
}
