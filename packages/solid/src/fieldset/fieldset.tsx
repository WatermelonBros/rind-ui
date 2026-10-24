/** @jsxImportSource solid-js */
import {
  type FieldsetPart,
  type FieldsetScope,
  fieldsetConnect,
  labelInteraction,
  legendScope,
  partId,
  scopeDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { FieldsetScopeContext } from "./context"

interface PartsCtx {
  readonly instance: Accessor<string>
  readonly registry: PartRegistry<FieldsetPart>
  readonly disabled: Accessor<boolean>
  readonly invalid: Accessor<boolean>
  readonly scope: Accessor<FieldsetScope>
}
const PartsContext = createContext<PartsCtx>()
function useParts(part: string): PartsCtx {
  const ctx = useContext(PartsContext)
  if (!ctx) throw new Error(`Fieldset.${part} must be inside Fieldset.Root`)
  return ctx
}

export interface FieldsetState {
  readonly disabled: boolean
  readonly invalid: boolean
}

export type FieldsetRootProps = Omit<
  JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>,
  "children"
> & {
  /** Disables every control inside, native and rind-ui (portalled parts too). */
  readonly disabled?: boolean | undefined
  /** Shows the ErrorMessage; never passed to the controls inside. */
  readonly invalid?: boolean | undefined
  readonly render?: RenderProp<FieldsetState> | undefined
  readonly children?: JSX.Element
}

function Root(props: FieldsetRootProps) {
  const [local, rest] = splitProps(props, [
    "disabled",
    "invalid",
    "render",
    "id",
    "aria-describedby",
    "children",
  ])
  const parent = useContext(FieldsetScopeContext)
  const scope = createMemo<FieldsetScope>(() => ({
    disabled: local.disabled === true,
    parent: parent?.() ?? null,
  }))
  const disabled = createMemo(() => scopeDisabled(scope()))
  const invalid = () => local.invalid === true
  const instance = useRootId(() => local.id)
  const registry = usePartRegistry<FieldsetPart>({
    scope: "fieldset",
    // No expected parts: a relation to a Description or ErrorMessage exists only once it is
    // rendered (ark#3707), so the server never points at a missing id.
    root: instance(),
  })
  const [el, setEl] = createSignal<Element | null>(null)
  const rootTag = () => (local.render ? (el()?.tagName.toLowerCase() ?? "fieldset") : "fieldset")
  // The server assumes the default markup; after mount, the real first child decides.
  const [nativeLegend, setNativeLegend] = createSignal(true)
  afterMount(() => {
    const first = el()?.firstElementChild
    setNativeLegend(first?.tagName === "LEGEND" && first.getAttribute("data-part") === "legend")
  })
  const ids = {
    legend: useRenderedId(registry, "legend"),
    description: useRenderedId(registry, "description"),
    "error-message": useRenderedId(registry, "error-message"),
  }
  const api = createMemo(() =>
    fieldsetConnect({
      instance: instance(),
      disabled: disabled(),
      invalid: invalid(),
      rootTag: rootTag(),
      nativeLegend: nativeLegend(),
      ids: {
        legend: ids.legend(),
        description: ids.description(),
        "error-message": ids["error-message"](),
      },
      describedBy: local["aria-describedby"],
    }),
  )
  const state = reactive<FieldsetState>(() => ({ disabled: disabled(), invalid: invalid() }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        ...(local.id === undefined ? {} : { id: local.id }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return (
    <FieldsetScopeContext.Provider value={scope}>
      <PartsContext.Provider value={{ instance, registry, disabled, invalid, scope }}>
        {renderPart(local.render, merged, state, children, (p) => (
          <fieldset {...p}>{children()}</fieldset>
        ))}
      </PartsContext.Provider>
    </FieldsetScopeContext.Provider>
  )
}

const apiOf = (ctx: PartsCtx) =>
  fieldsetConnect({
    instance: ctx.instance(),
    disabled: ctx.disabled(),
    invalid: ctx.invalid(),
    rootTag: "fieldset",
    nativeLegend: true,
    ids: {},
  })

const stateOf = (ctx: PartsCtx) =>
  reactive<FieldsetState>(() => ({ disabled: ctx.disabled(), invalid: ctx.invalid() }))

type PartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<FieldsetState> | undefined
  readonly children?: JSX.Element
}

function Legend(props: PartProps<JSX.HTMLAttributes<HTMLLegendElement>>) {
  const [local, rest] = splitProps(props, ["render", "id", "children"])
  const ctx = useParts("Legend")
  const env = useEnvironment()
  const own = () => local.id ?? partId("fieldset", ctx.instance(), "legend")
  useRegisterPart(ctx.registry, "legend", own)
  const [el, setEl] = createSignal<Element | null>(null)
  // HTML exempts only the fieldset's first <legend> child. The server assumes the default
  // markup (first); after mount the real position decides.
  const [first, setFirst] = createSignal(true)
  afterMount(() => {
    const node = el()
    const legend = node?.parentElement
      ? Array.from(node.parentElement.children).find((c) => c.tagName === "LEGEND")
      : undefined
    setFirst(node?.tagName === "LEGEND" && legend === node)
  })
  // A legend activates nothing: only the label double-click selection guard.
  const interaction = normalizeProps(
    labelInteraction(env, { target: () => null, forwardsFocus: () => false }),
  )
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(apiOf(ctx).legend(own())), ...interaction, ref: setEl }, rest),
  )
  const state = stateOf(ctx)
  const children = () => local.children
  // HTML: controls in the first legend are exempt from this Fieldset's disabled state.
  const scope = createMemo(() => (first() ? legendScope(ctx.scope()) : ctx.scope()))
  return (
    <FieldsetScopeContext.Provider value={scope}>
      {renderPart(local.render, merged, state, children, (p) => (
        <legend {...p}>{children()}</legend>
      ))}
    </FieldsetScopeContext.Provider>
  )
}

function Description(props: PartProps<JSX.HTMLAttributes<HTMLParagraphElement>>) {
  const [local, rest] = splitProps(props, ["render", "id", "children"])
  const ctx = useParts("Description")
  const own = () => local.id ?? partId("fieldset", ctx.instance(), "description")
  useRegisterPart(ctx.registry, "description", own)
  const merged = createMemo(() => mergeProps(normalizeProps(apiOf(ctx).description(own())), rest))
  const children = () => local.children
  return renderPart(local.render, merged, stateOf(ctx), children, (p) => <p {...p}>{children()}</p>)
}

/** Rendered while the Fieldset is invalid (or with `forceMount`). */
function ErrorMessageShown(props: PartProps<JSX.HTMLAttributes<HTMLParagraphElement>>) {
  const [local, rest] = splitProps(props, ["render", "id", "children"])
  const ctx = useParts("ErrorMessage")
  const own = () => local.id ?? partId("fieldset", ctx.instance(), "error-message")
  useRegisterPart(ctx.registry, "error-message", own)
  const merged = createMemo(() => mergeProps(normalizeProps(apiOf(ctx).errorMessage(own())), rest))
  const children = () => local.children
  return renderPart(local.render, merged, stateOf(ctx), children, (p) => <p {...p}>{children()}</p>)
}

function ErrorMessage(
  props: PartProps<JSX.HTMLAttributes<HTMLParagraphElement>> & {
    readonly forceMount?: boolean | undefined
  },
) {
  const [local, rest] = splitProps(props, ["forceMount"])
  const ctx = useParts("ErrorMessage")
  return (
    <Show when={ctx.invalid() || local.forceMount === true}>
      <ErrorMessageShown {...rest} />
    </Show>
  )
}

/** The parts, by name: `fieldset.parts.ts` re-exports them as the `Fieldset` namespace. */
export { Description, ErrorMessage, Legend, Root }
