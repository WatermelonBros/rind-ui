import {
  blurEvent,
  type ChangeDetails,
  type CheckboxEvent,
  type CheckedState,
  checkboxConnect,
  checkboxMachine,
  checkboxMachineProps,
  focusEvent,
  focusSafely,
  hiddenFormInput,
  implicitSubmit,
  isImeKey,
  labelInteraction,
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
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

const mirrorOf = (v: CheckedState) => ({
  checked: v === true,
  indeterminate: v === "indeterminate",
})

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface CheckboxState {
  readonly checked: CheckedState
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Machine = ReturnType<typeof useMachine<typeof checkboxMachine>>

interface Ctx {
  readonly instance: string
  readonly view: Machine["view"]
  readonly send: Machine["send"]
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
}
const CheckboxContext = createContext<Ctx | null>(null)
function useCheckbox(part: string): Ctx {
  const ctx = useContext(CheckboxContext)
  if (!ctx) throw new Error(`Checkbox.${part} must be inside Checkbox.Root`)
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
  const modality = useModality(env.modality, ctx.view.context.focused)
  const description = useRenderedId(ctx.registry, "description")
  const label = useRenderedId(ctx.registry, "label")
  const labelable = ctx.controlTag === "button" || ctx.controlTag === "input"
  const field = mergeFieldProps(
    {
      role: "checkbox",
      labelable,
      ...ctx.own,
      describedBy: description,
      consumerDescribedBy: extra.describedBy,
      ariaLabel: extra.ariaLabel,
      ariaLabelledBy: extra.ariaLabelledBy,
    },
    ctx.binding,
  )
  return checkboxConnect(
    {
      instance: ctx.instance,
      checked: ctx.view.values.checked ?? false,
      tag: ctx.controlTag,
      labelable,
      field,
      focusableWhenDisabled: ctx.focusableWhenDisabled,
      focused: ctx.view.context.focused,
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

export type CheckboxRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultChecked"
> & {
  readonly children?: ReactNode
  readonly checked?: CheckedState
  /** Read at creation; a later change only changes what a form reset restores. */
  readonly defaultChecked?: CheckedState
  readonly onCheckedChange?: (checked: CheckedState, details: ChangeDetails<CheckboxEvent>) => void
  readonly disabled?: boolean
  readonly focusableWhenDisabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  readonly invalid?: boolean
  readonly name?: string
  /** Submitted while checked (default "on"). */
  readonly value?: string
  readonly form?: string
  /** Submitted while unchecked (and enabled); unchecked submits nothing without it. */
  readonly uncheckedValue?: string
  readonly render?: RenderProp<CheckboxState>
}

function Root({
  checked,
  defaultChecked = false,
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
}: CheckboxRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const binding = useFieldControl()
  const controlEl = useRef<HTMLElement | null>(null)
  const inputEl = useRef<HTMLInputElement | null>(null)
  const [controlTag, setControlTag] = useState("button")
  // A rind-ui Fieldset's context reaches portalled parts; the DOM tracker native fieldsets.
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = useState(false)
  const field = mergeFieldProps(
    {
      role: "checkbox",
      labelable: true,
      disabled: disabled || fieldsetContext || fieldsetDom,
      readOnly,
      required,
      invalid,
      name,
    },
    binding,
  )
  const formInput = useMemo(
    () => hiddenFormInput({ input: () => inputEl.current, control: () => controlEl.current }, env),
    [env],
  )
  // The reason of the latest proposal, for the Field's change report (user or reset).
  const lastReason = useRef<string | null>(null)
  const { view, send } = useMachine(
    checkboxMachine,
    checkboxMachineProps(
      {
        checked,
        defaultChecked,
        onCheckedChange: (next, details) => {
          lastReason.current = details.reason
          onCheckedChange?.(next, details)
        },
        disabled: field.disabled,
        readOnly: field.readOnly,
      },
      formInput,
    ),
    { formInput },
  )
  const current = view.values.checked ?? false
  // After every commit: the input reflects the value (hydration, re-renders); no events.
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
      }),
    [formInput, send],
  )
  useEffect(() => {
    const node = controlEl.current
    if (!node) return
    const watch = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    return watch.stop
  }, [])
  const ids = {
    control: binding?.controlId ?? partId("checkbox", instance, "control"),
    label: partId("checkbox", instance, "label"),
    description: partId("checkbox", instance, "description"),
    hiddenInput: partId("checkbox", instance, "hidden-input"),
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
          if (controlEl.current) void focusSafely(controlEl.current, env, "programmatic", modality)
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
  const registry = usePartRegistry<"label" | "description">({ scope: "checkbox", root: instance })
  const ctx: Ctx = {
    instance,
    view,
    send,
    binding,
    own: {
      disabled: disabled || fieldsetContext || fieldsetDom,
      readOnly,
      required,
      invalid,
      name,
    },
    focusableWhenDisabled,
    ids,
    registry,
    controlEl,
    inputEl,
    controlTag,
    setControlTag,
    hidden: { value, form, defaultChecked },
    uncheckedValue,
  }
  const api = useApi(ctx)
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  const unchecked = api.uncheckedInput()
  const state: CheckboxState = {
    checked: current,
    disabled: field.disabled,
    readOnly: field.readOnly,
  }
  return (
    <CheckboxContext value={ctx}>
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
    </CheckboxContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<CheckboxState>
}

function stateOf(ctx: Ctx, api: ReturnType<typeof useApi>): CheckboxState {
  const root = api.root()
  return {
    checked: ctx.view.values.checked ?? false,
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
  const ctx = useCheckbox("Control")
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
      if (e.type === "PRESS") ctx.send({ type: "TOGGLE", modality: e.modality })
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
  const own = normalizeProps(api.control())
  const props = mergeProps(
    {
      // The Enter handler runs before press.ts, which prevents Enter's native click; a
      // consumer's preventDefault (its handlers run first) still cancels the submission.
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
            ctx.send(focusEvent(e.currentTarget, env.modality)),
          onBlur: () => ctx.send(blurEvent(env.modality)),
        },
      ),
      ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel }),
      ref: composeRefs(composeRefs(el, ctx.controlEl), ref),
    },
    rest,
  )
  return renderPart("button", props, render, stateOf(ctx, api))
}

export type CheckboxIndicatorProps = Omit<ComponentPropsWithRef<"span">, "children"> & {
  /** Content, or a function of the state (draw a check or a dash). */
  readonly children?:
    | ReactNode
    | ((state: { checked: boolean; indeterminate: boolean }) => ReactNode)
  readonly render?: RenderProp<CheckboxState>
}

function Indicator({ render, children, ...rest }: CheckboxIndicatorProps) {
  const ctx = useCheckbox("Indicator")
  const api = useApi(ctx)
  const value = ctx.view.values.checked ?? false
  const content =
    typeof children === "function"
      ? children({ checked: value === true, indeterminate: value === "indeterminate" })
      : children
  const props = mergeProps(normalizeProps(api.indicator()), rest)
  return renderPart("span", { ...props, children: content }, render, stateOf(ctx, api))
}

function Label({ render, ref, ...rest }: PartProps<"label">) {
  const ctx = useCheckbox("Label")
  const env = useEnvironment()
  useRegisterPart(ctx.registry, "label", ctx.ids.label)
  const api = useApi(ctx)
  const labelable = ctx.controlTag === "button" || ctx.controlTag === "input"
  // An own Label inside a Field: the Field's names the control.
  const inField = ctx.binding !== null
  useEffect(() => {
    if (inField) warnOwnLabelInField("checkbox")
  }, [inField])
  const interaction = labelInteraction(env, {
    target: () => ctx.controlEl.current,
    forwardsFocus: () => !labelable,
    // The non-labelable fallback: focus the control and toggle it once.
    focusTarget: () => {
      const control = ctx.controlEl.current
      if (control) void focusSafely(control, env, "programmatic")
      ctx.send({ type: "TOGGLE", modality: env.modality.modality() })
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
  const ctx = useCheckbox("Description")
  useRegisterPart(ctx.registry, "description", ctx.ids.description)
  const api = useApi(ctx)
  const props = mergeProps(normalizeProps(api.description()), rest)
  return renderPart("div", props, render, stateOf(ctx, api))
}

export const Checkbox = { Root, Control, Indicator, Label, Description }
