"use client"

import {
  type ChangeDetails,
  type CheckboxGroupEvent,
  checkboxGroupConnect,
  checkboxGroupMachine,
  focusSafely,
  type Modality,
  mergeFieldProps,
  partId,
  readValidity,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react"
import {
  Checkbox,
  type CheckboxIndicatorProps,
  type CheckboxRootProps,
  type CheckboxState,
} from "../checkbox/checkbox"
import { useFieldControl } from "../field/field"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import {
  type FormToggleGrouped,
  type FormToggleGrouping,
  FormToggleGroupingContext,
} from "../form-toggle/form-toggle"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useRenderedTag } from "../use-rendered-tag"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

type GroupPart = "label" | "description" | "error-message"

interface Ctx {
  readonly instance: string
  readonly api: ReturnType<typeof checkboxGroupConnect>
  readonly registry: ReturnType<typeof usePartRegistry<GroupPart>>
  readonly ids: { label: string; description: string; errorMessage: string }
  readonly setLabelTag: (tag: string) => void
  readonly hasParent: boolean
  /** The group's own ErrorMessage defers to the Field's inside one. */
  readonly inField: boolean
  readonly invalid: boolean
  readonly parentGrouping: FormToggleGrouping
}
const GroupContext = createContext<Ctx | null>(null)
function useGroup(part: string): Ctx {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error(`CheckboxGroup.${part} must be inside CheckboxGroup.Root`)
  return ctx
}

export interface CheckboxGroupState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

export type CheckboxGroupRootProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  /** The group's parts (Label, checkboxes, Description, ErrorMessage). */
  readonly children?: ReactNode
  readonly value?: readonly string[]
  readonly defaultValue?: readonly string[]
  readonly onValueChange?: (
    value: readonly string[],
    details: ChangeDetails<CheckboxGroupEvent>,
  ) => void
  /** Every item value: what the select-all Parent selects (required with a Parent). */
  readonly allValues?: readonly string[]
  readonly disabled?: boolean
  readonly readOnly?: boolean
  /** Valid with at least one item checked. */
  readonly required?: boolean
  readonly invalid?: boolean
  /** Submitted for every checked item (an item's own `name` is ignored). */
  readonly name?: string
  readonly form?: string
  /** Another element or a render function receiving the props and the group's state. */
  readonly render?: RenderProp<CheckboxGroupState>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  allValues,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  render,
  id,
  ref,
  children,
  ...rest
}: CheckboxGroupRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const binding = useFieldControl()
  const fieldsetDisabled = useFieldsetDisabled()
  const field = mergeFieldProps(
    {
      role: "group",
      labelable: false,
      disabled: disabled || fieldsetDisabled,
      readOnly,
      required,
      invalid,
      name,
    },
    binding,
  )
  const el = useRef<HTMLElement | null>(null)
  const rootTag = useRenderedTag("div", render, el)
  const labelTag = useRef("span")
  // The reason of the latest accepted change, for the Field: only a user's clears its
  // external (server) errors (base-ui#1745); a parent's value or a reset does not.
  const lastReason = useRef<string | null>(null)
  const { view, send } = useMachine(checkboxGroupMachine, {
    value,
    defaultValue,
    onValueChange: (next, details) => {
      lastReason.current = details.reason
      onValueChange?.(next, details)
    },
    allValues,
    disabled: field.disabled,
    readOnly: field.readOnly,
  })
  const current = view.values.value ?? []
  const registry = usePartRegistry<GroupPart>({ scope: "checkbox-group", root: instance })
  const ids = {
    label: partId("checkbox-group", instance, "label"),
    description: partId("checkbox-group", instance, "description"),
    errorMessage: partId("checkbox-group", instance, "error-message"),
  }
  const rendered = {
    label: useRenderedId(registry, "label"),
    description: useRenderedId(registry, "description"),
    errorMessage: useRenderedId(registry, "error-message"),
  }
  // Rendered item Control ids in `allValues` order (the Parent's aria-controls).
  const items = view.context.items
  const order = allValues ?? [...items.keys()]
  const controls = order.flatMap((v) => {
    const item = items.get(v)
    return item ? [item.id] : []
  })
  const api = checkboxGroupConnect({
    instance,
    value: current,
    allValues: allValues ?? [],
    disabled: field.disabled,
    readOnly: field.readOnly,
    required: field.required || field["aria-required"] === "true",
    invalid: field.invalid,
    name: field.name,
    form,
    rootTag,
    labelTag: labelTag.current,
    ids,
    rendered,
    ...(binding ? { field: binding.ids } : {}),
    controls,
  })
  // One stable register function per item value: re-renders never re-register.
  const registers = useRef(new Map<string, (controlId: string, disabled: boolean) => () => void>())
  const registerFor = (v: string) => {
    let fn = registers.current.get(v)
    if (!fn) {
      fn = (controlId, isDisabled) => {
        send({ type: "ITEM.REGISTER", value: v, id: controlId, disabled: isDisabled })
        return () => send({ type: "ITEM.UNREGISTER", value: v, id: controlId })
      }
      registers.current.set(v, fn)
    }
    return fn
  }
  const itemGrouping: FormToggleGrouping = {
    resolve: (v, own) => {
      if (process.env.NODE_ENV !== "production" && v === "on") {
        // The Checkbox default value: an item without its own `value`.
        console.error("[rind-ui] checkbox-group: an item needs a `value`")
      }
      return {
        props: api.item(v, own),
        onChange: (checked: boolean | "indeterminate", modality: Modality) =>
          send({ type: "ITEM.TOGGLE", value: v, checked: checked === true, modality }),
        register: registerFor(v),
      } satisfies FormToggleGrouped
    },
  }
  const parentGrouping: FormToggleGrouping = {
    resolve: () => ({
      props: api.parent(),
      onChange: (_checked, modality) => send({ type: "PARENT.TOGGLE", modality }),
    }),
  }
  // Development: `allValues` and the rendered items must agree (the Parent selects them).
  const registeredKey = [...items.keys()].sort().join("\u0000")
  const allKey = allValues ? [...allValues].sort().join("\u0000") : null
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || allKey === null || registeredKey === "") return
    const registered = registeredKey.split("\u0000")
    const all = allKey.split("\u0000")
    const extra = registered.filter((v) => !all.includes(v))
    const missing = all.filter((v) => !registered.includes(v))
    if (extra.length > 0) {
      console.warn(`[rind-ui] checkbox-group: items ${JSON.stringify(extra)} are not in allValues`)
    }
    if (missing.length > 0) {
      console.warn(
        `[rind-ui] checkbox-group: allValues ${JSON.stringify(missing)} have no rendered item`,
      )
    }
  }, [registeredKey, allKey])
  // A form reset is answered once, by the group, for every item (RA#7749).
  useEffect(() => {
    const node = el.current
    if (!node) return
    const doc = node.ownerDocument
    const onReset = (e: Event) => {
      if (e.defaultPrevented) return
      const input = node.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
      if (input && e.target === input.form) send({ type: "RESET" })
    }
    doc.addEventListener("reset", onReset)
    return () => doc.removeEventListener("reset", onReset)
  }, [send])
  // field-control: the group registers once as one (non-labelable) control.
  const register = binding?.register
  const latest = useRef(current)
  latest.current = current
  // The items' hidden inputs (the Parent's submits nothing and validates nothing).
  const controlInputs = () =>
    Array.from(
      el.current?.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]') ?? [],
    ).filter((i) => i.closest("[data-parent]") === null)
  useIsoLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: instance,
        labelable: false,
        // The first invalid item, else the first enabled one (base-ui#5200).
        focus: (modality) => {
          const inputs = controlInputs()
          const target =
            inputs.find((i) => !i.disabled && !readValidity(i).valid) ??
            inputs.find((i) => !i.disabled)
          const control = target?.closest('[data-scope="checkbox"][data-part="root"]')
          const button = control?.querySelector<HTMLElement>('[data-part="control"]')
          if (button) void focusSafely(button, env, "programmatic", modality)
        },
        validityElement: () =>
          controlInputs().find((i) => !readValidity(i).valid) ?? controlInputs()[0] ?? null,
        value: () => latest.current,
      },
      instance,
    )
  }, [register, instance, env])
  const reported = useRef(current)
  const report = binding?.report
  useEffect(() => {
    if (reported.current === current) return
    reported.current = current
    const user = lastReason.current === "ITEM.TOGGLE" || lastReason.current === "PARENT.TOGGLE"
    lastReason.current = null
    report?.({ type: "change", value: current, user, composing: false })
    report?.({ type: "commit" })
  }, [current, report])
  const ctx: Ctx = {
    instance,
    api,
    registry,
    ids,
    setLabelTag: (tag) => {
      labelTag.current = tag
    },
    hasParent: allValues !== undefined,
    inField: binding !== null,
    invalid: field.invalid,
    parentGrouping,
  }
  const props = mergeProps(
    {
      ...normalizeProps({ ...api.root(), ...binding?.data }),
      ...(id === undefined ? {} : { id }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  const state: CheckboxGroupState = { value: current, disabled: field.disabled }
  return (
    <GroupContext value={ctx}>
      <FormToggleGroupingContext value={itemGrouping}>
        {renderPart("div", { ...props, children }, render, state)}
      </FormToggleGroupingContext>
    </GroupContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined>
}

function Label({ render, ref, ...rest }: PartProps<"span">) {
  const ctx = useGroup("Label")
  useRegisterPart(ctx.registry, "label", ctx.ids.label)
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("span", render, el)
  ctx.setLabelTag(tag)
  const props = mergeProps({ ...normalizeProps(ctx.api.label()), ref: composeRefs(el, ref) }, rest)
  return renderPart("span", props, render, undefined)
}

function Description({ render, ...rest }: PartProps<"p">) {
  const ctx = useGroup("Description")
  useRegisterPart(ctx.registry, "description", ctx.ids.description)
  const props = mergeProps(normalizeProps(ctx.api.description()), rest)
  return renderPart("p", props, render, undefined)
}

function ErrorMessage({ render, ...rest }: PartProps<"p">) {
  const ctx = useGroup("ErrorMessage")
  // Inside a Field the Field's ErrorMessage is the one; shown only while invalid.
  const shown = !ctx.inField && ctx.invalid
  useRegisterPart(ctx.registry, "error-message", shown ? ctx.ids.errorMessage : undefined)
  const props = mergeProps(normalizeProps(ctx.api.errorMessage()), rest)
  if (!shown) return null
  return renderPart("p", props, render, undefined)
}

/** The select-all checkbox: a Checkbox whose state the group derives. */
function Parent(props: Omit<CheckboxRootProps, "checked" | "defaultChecked" | "onCheckedChange">) {
  const ctx = useGroup("Parent")
  if (process.env.NODE_ENV !== "production" && !ctx.hasParent) {
    console.error("[rind-ui] checkbox-group: a Parent needs `allValues` on CheckboxGroup.Root")
  }
  return (
    <FormToggleGroupingContext value={ctx.parentGrouping}>
      <Checkbox.Root {...props} />
    </FormToggleGroupingContext>
  )
}

/**
 * A checkbox: inside `CheckboxGroup.Root` one of the group's (its `value` joins the group's
 * value); alone, a single two- or three-state checkbox with its own `checked`.
 */
const Item = Checkbox.Root
/** Its check mark (or the indeterminate dash), rendered while checked. */
const ItemIndicator = Checkbox.Indicator

export type CheckboxGroupItemProps = CheckboxRootProps
export type CheckboxGroupItemIndicatorProps = CheckboxIndicatorProps
export type CheckboxGroupItemState = CheckboxState

/** The item's (or the Parent's) focusable box. The group's own Label/Description are separate. */
const ItemControl = Checkbox.Control
/** The item's label; names its Control. */
const ItemLabel = Checkbox.Label
/** The item's description, wired into `aria-describedby`. */
const ItemDescription = Checkbox.Description

export const CheckboxGroup = {
  Root,
  Label,
  Description,
  ErrorMessage,
  Parent,
  Item,
  ItemControl,
  ItemIndicator,
  ItemLabel,
  ItemDescription,
}
