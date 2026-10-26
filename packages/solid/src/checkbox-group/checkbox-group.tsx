/** @jsxImportSource solid-js */
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
import { Checkbox } from "../checkbox/checkbox"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import {
  type FormToggleGrouped,
  type FormToggleGrouping,
  FormToggleGroupingContext,
} from "../form-toggle/form-toggle"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare const process: { env: { NODE_ENV?: string } }

type GroupPart = "label" | "description" | "error-message"

interface Ctx {
  readonly api: Accessor<ReturnType<typeof checkboxGroupConnect>>
  readonly registry: PartRegistry<GroupPart>
  readonly ids: () => { label: string; description: string; errorMessage: string }
  readonly setLabelTag: (tag: string) => void
  readonly hasParent: () => boolean
  /** The group's own ErrorMessage defers to the Field's inside one. */
  readonly inField: boolean
  readonly invalid: () => boolean
  readonly parentGrouping: FormToggleGrouping
}
const GroupContext = createContext<Ctx>()
function useGroup(part: string): Ctx {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error(`CheckboxGroup.${part} must be inside CheckboxGroup.Root`)
  return ctx
}

export interface CheckboxGroupState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

export type CheckboxGroupRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "id"
> & {
  readonly value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<CheckboxGroupEvent>) => void)
    | undefined
  /** Every item value: what the select-all Parent selects (required with a Parent). */
  readonly allValues?: readonly string[] | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  /** Valid with at least one item checked. */
  readonly required?: boolean | undefined
  readonly invalid?: boolean | undefined
  /** Submitted for every checked item (an item's own `name` is ignored). */
  readonly name?: string | undefined
  readonly form?: string | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<CheckboxGroupState> | undefined
  readonly children?: JSX.Element | ((state: CheckboxGroupState) => JSX.Element)
}

function Root(props: CheckboxGroupRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "allValues",
    "disabled",
    "readOnly",
    "required",
    "invalid",
    "name",
    "form",
    "id",
    "render",
    "children",
  ])
  const env = useEnvironment()
  const instance = useRootId(() => local.id)
  const binding = useFieldControl()
  const fieldsetDisabled = useFieldsetDisabled()
  // A native <fieldset disabled> too: the items are disabled by it (toggle.md RA#9445).
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const field = createMemo(() =>
    mergeFieldProps(
      {
        role: "group",
        labelable: false,
        disabled: local.disabled === true || fieldsetDisabled() || fieldsetDom(),
        readOnly: local.readOnly === true,
        required: local.required === true,
        invalid: local.invalid === true,
        name: local.name,
      },
      binding?.() ?? null,
    ),
  )
  const [el, setEl] = createSignal<Element | null>(null)
  createEffect(() => {
    const node = el()
    if (!node) return
    const watch = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    onCleanup(watch.stop)
  })
  const rootTag = () => (local.render ? (el()?.tagName.toLowerCase() ?? "div") : "div")
  const [labelTag, setLabelTag] = createSignal("span")
  // The reason of the latest accepted change, for the Field: only a user's clears its
  // external (server) errors (base-ui#1745); a parent's value or a reset does not.
  let lastReason: string | null = null
  const { view, send } = useMachine(checkboxGroupMachine, () => ({
    value: local.value,
    defaultValue: local.defaultValue,
    onValueChange: (next: readonly string[], details: ChangeDetails<CheckboxGroupEvent>) => {
      lastReason = details.reason
      local.onValueChange?.(next, details)
    },
    allValues: local.allValues,
    disabled: field().disabled,
    readOnly: field().readOnly,
  }))
  const current = (): readonly string[] => view().values.value ?? []
  const registry = usePartRegistry<GroupPart>({ scope: "checkbox-group", root: instance() })
  const ids = () => ({
    label: partId("checkbox-group", instance(), "label"),
    description: partId("checkbox-group", instance(), "description"),
    errorMessage: partId("checkbox-group", instance(), "error-message"),
  })
  const rendered = {
    label: useRenderedId(registry, "label"),
    description: useRenderedId(registry, "description"),
    errorMessage: useRenderedId(registry, "error-message"),
  }
  const api = createMemo(() => {
    // Rendered item Control ids in `allValues` order (the Parent's aria-controls).
    const items = view().context.items
    const order = local.allValues ?? [...items.keys()]
    const controls = order.flatMap((v) => {
      const item = items.get(v)
      return item ? [item.id] : []
    })
    return checkboxGroupConnect({
      instance: instance(),
      value: current(),
      allValues: local.allValues ?? [],
      disabled: field().disabled,
      readOnly: field().readOnly,
      required: field().required || field()["aria-required"] === "true",
      invalid: field().invalid,
      name: field().name,
      form: local.form,
      rootTag: rootTag(),
      labelTag: labelTag(),
      ids: ids(),
      rendered: {
        label: rendered.label(),
        description: rendered.description(),
        errorMessage: rendered.errorMessage(),
      },
      ...(binding ? { field: binding().ids } : {}),
      controls,
    })
  })
  // One stable register function per item value: updates never re-register.
  const registers = new Map<string, (controlId: string, disabled: boolean) => () => void>()
  const registerFor = (v: string) => {
    let fn = registers.get(v)
    if (!fn) {
      fn = (controlId, isDisabled) => {
        send({ type: "ITEM.REGISTER", value: v, id: controlId, disabled: isDisabled })
        return () => send({ type: "ITEM.UNREGISTER", value: v, id: controlId })
      }
      registers.set(v, fn)
    }
    return fn
  }
  const itemGrouping = createMemo<FormToggleGrouping>(() => {
    const a = api()
    return {
      resolve: (v, own) => {
        if (process.env.NODE_ENV !== "production" && v === "on") {
          // The Checkbox default value: an item without its own `value`.
          console.error("[rind-ui] checkbox-group: an item needs a `value`")
        }
        return {
          props: a.item(v, own),
          onChange: (checked: boolean | "indeterminate", modality: Modality) =>
            send({ type: "ITEM.TOGGLE", value: v, checked: checked === true, modality }),
          register: registerFor(v),
        } satisfies FormToggleGrouped
      },
    }
  })
  const parentGrouping: FormToggleGrouping = {
    resolve: () => ({
      props: api().parent(),
      onChange: (_checked, modality) => send({ type: "PARENT.TOGGLE", modality }),
    }),
  }
  // The items' hidden inputs (the Parent's submits nothing and validates nothing).
  const controlInputs = () =>
    Array.from(el()?.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]') ?? []).filter(
      (i) => i.closest("[data-parent]") === null,
    )
  afterMount(() => {
    // Development: `allValues` and the rendered items must agree (the Parent selects them).
    // Checked once the registrations of the flush are in (items register one by one).
    if (process.env.NODE_ENV !== "production") {
      let warned = ""
      const verify = () => {
        const registeredKey = [...untrack(view).context.items.keys()].sort().join("\u0000")
        const allKey = local.allValues ? [...local.allValues].sort().join("\u0000") : null
        if (allKey === null || registeredKey === "" || warned === `${registeredKey}|${allKey}`)
          return
        warned = `${registeredKey}|${allKey}`
        const registered = registeredKey.split("\u0000")
        const all = allKey.split("\u0000")
        const extra = registered.filter((v) => !all.includes(v))
        const missing = all.filter((v) => !registered.includes(v))
        if (extra.length > 0)
          console.warn(
            `[rind-ui] checkbox-group: items ${JSON.stringify(extra)} are not in allValues`,
          )
        if (missing.length > 0)
          console.warn(
            `[rind-ui] checkbox-group: allValues ${JSON.stringify(missing)} have no rendered item`,
          )
      }
      createEffect(() => {
        view().context.items
        local.allValues
        queueMicrotask(verify)
      })
    }
    // A form reset is answered once, by the group, for every item (RA#7749).
    const node = el()
    if (node) {
      const doc = node.ownerDocument
      const onReset = (e: Event) => {
        if (e.defaultPrevented) return
        const input = node.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
        if (input && e.target === input.form) send({ type: "RESET" })
      }
      doc.addEventListener("reset", onReset)
      onCleanup(() => doc.removeEventListener("reset", onReset))
    }
    // field-control: the group registers once as one (non-labelable) control.
    if (binding) {
      const off = untrack(() =>
        binding().register(
          {
            id: instance(),
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
            value: () => untrack(current),
          },
          instance(),
        ),
      )
      onCleanup(off)
    }
    createEffect(
      on(
        current,
        (now) => {
          const user = lastReason === "ITEM.TOGGLE" || lastReason === "PARENT.TOGGLE"
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
  const state = reactive<CheckboxGroupState>(() => ({
    value: current(),
    disabled: field().disabled,
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps({ ...api().root(), ...binding?.().data }),
        ...(local.id === undefined ? {} : { id: local.id }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <GroupContext.Provider
      value={{
        api,
        registry,
        ids,
        setLabelTag,
        hasParent: () => local.allValues !== undefined,
        inField: binding !== null,
        invalid: () => field().invalid,
        parentGrouping,
      }}
    >
      <FormToggleGroupingContext.Provider value={itemGrouping}>
        {renderPart(local.render, merged, state, children, (p) => (
          <div {...p}>{children()}</div>
        ))}
      </FormToggleGroupingContext.Provider>
    </GroupContext.Provider>
  )
}

export type CheckboxGroupLabelProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

function Label(props: CheckboxGroupLabelProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useGroup("Label")
  useRegisterPart(ctx.registry, "label", () => ctx.ids().label)
  const [el, setEl] = createSignal<Element | null>(null)
  afterMount(() =>
    createEffect(() =>
      ctx.setLabelTag(local.render ? (el()?.tagName.toLowerCase() ?? "span") : "span"),
    ),
  )
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().label()), ref: setEl }, rest),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type CheckboxGroupDescriptionProps = Omit<
  JSX.HTMLAttributes<HTMLParagraphElement>,
  "children"
> & {
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

function Description(props: CheckboxGroupDescriptionProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useGroup("Description")
  useRegisterPart(ctx.registry, "description", () => ctx.ids().description)
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().description()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => <p {...p}>{children()}</p>)
}

export type CheckboxGroupErrorMessageProps = CheckboxGroupDescriptionProps

function ErrorMessage(props: CheckboxGroupErrorMessageProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useGroup("ErrorMessage")
  // Inside a Field the Field's ErrorMessage is the one; shown only while invalid.
  const shown = () => !ctx.inField && ctx.invalid()
  useRegisterPart(ctx.registry, "error-message", () =>
    shown() ? ctx.ids().errorMessage : undefined,
  )
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().errorMessage()), rest))
  const children = () => local.children
  return (
    <Show when={shown()}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <p {...p}>{children()}</p>
      ))}
    </Show>
  )
}

/** The select-all checkbox: a Checkbox whose state the group derives. */
function Parent(props: Parameters<typeof Checkbox.Root>[0]) {
  const ctx = useGroup("Parent")
  if (process.env.NODE_ENV !== "production" && !ctx.hasParent()) {
    console.error("[rind-ui] checkbox-group: a Parent needs `allValues` on CheckboxGroup.Root")
  }
  return (
    <FormToggleGroupingContext.Provider value={() => ctx.parentGrouping}>
      <Checkbox.Root {...props} />
    </FormToggleGroupingContext.Provider>
  )
}

/**
 * A checkbox: inside `CheckboxGroup.Root` one of the group's (its `value` joins the group's
 * value); alone, a single two- or three-state checkbox with its own `checked`.
 */
const Item = Checkbox.Root
/** Its check mark (or the indeterminate dash), rendered while checked. */
const ItemIndicator = Checkbox.Indicator
/** The item's (or the Parent's) focusable box. The group's own Label/Description are separate. */
const ItemControl = Checkbox.Control
/** The item's label; names its Control. */
const ItemLabel = Checkbox.Label
/** The item's description, wired into `aria-describedby`. */
const ItemDescription = Checkbox.Description

/** The parts, by name: `checkbox-group.parts.ts` re-exports them as the `CheckboxGroup` namespace. */
export {
  Description,
  ErrorMessage,
  Item,
  ItemControl,
  ItemDescription,
  ItemIndicator,
  ItemLabel,
  Label,
  Parent,
  Root,
}
