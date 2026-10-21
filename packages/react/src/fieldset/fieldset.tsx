"use client"

import {
  type FieldsetPart,
  type FieldsetScope,
  fieldsetConnect,
  labelInteraction,
  legendScope,
  partId,
  scopeDisabled,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  type PartRegistry,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
} from "../use-ids"
import { useRenderedTag } from "../use-rendered-tag"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** The disabled scope of the enclosing Fieldsets (crosses portals: React context). */
const FieldsetScopeContext = createContext<FieldsetScope | null>(null)

/** Whether an enclosing rind-ui Fieldset disables this position (first-legend rule applied). */
export function useFieldsetDisabled(): boolean {
  return scopeDisabled(useContext(FieldsetScopeContext))
}

interface PartsCtx {
  readonly instance: string
  readonly registry: PartRegistry<FieldsetPart>
  readonly disabled: boolean
  readonly invalid: boolean
  readonly scope: FieldsetScope
}
const PartsContext = createContext<PartsCtx | null>(null)

function useParts(part: string): PartsCtx {
  const ctx = useContext(PartsContext)
  if (!ctx) throw new Error(`Fieldset.${part} must be inside Fieldset.Root`)
  return ctx
}

export interface FieldsetState {
  readonly disabled: boolean
  readonly invalid: boolean
}

export type FieldsetRootProps = ComponentPropsWithRef<"fieldset"> & {
  /** Disables every control inside, native and rind-ui (portalled parts too). */
  readonly disabled?: boolean
  /** Shows the ErrorMessage; never passed to the controls inside. */
  readonly invalid?: boolean
  readonly render?: RenderProp<FieldsetState>
}

function Root({
  disabled: own = false,
  invalid = false,
  render,
  id,
  ref,
  "aria-describedby": describedBy,
  ...rest
}: FieldsetRootProps) {
  const parent = useContext(FieldsetScopeContext)
  const scope = useMemo(() => ({ disabled: own, parent }), [own, parent])
  const disabled = scopeDisabled(scope)
  const instance = useRootId(id)
  const registry = usePartRegistry<FieldsetPart>({
    scope: "fieldset",
    // No expected parts: a relation to a Description or ErrorMessage exists only once it is
    // rendered (ark#3707), so the server never points at a missing id.
    root: instance,
  })
  const el = useRef<HTMLElement | null>(null)
  const rootTag = useRenderedTag("fieldset", render, el)
  // The server assumes the default markup; after commit, the real first child decides.
  const [nativeLegend, setNativeLegend] = useState(true)
  useIsoLayoutEffect(() => {
    const first = el.current?.firstElementChild
    setNativeLegend(first?.tagName === "LEGEND" && first.getAttribute("data-part") === "legend")
  })
  const ids = {
    legend: useRenderedId(registry, "legend"),
    description: useRenderedId(registry, "description"),
    "error-message": useRenderedId(registry, "error-message"),
  }
  const api = fieldsetConnect({
    instance,
    disabled,
    invalid,
    rootTag,
    nativeLegend,
    ids,
    describedBy,
  })
  const parts: PartsCtx = useMemo(
    () => ({ instance, registry, disabled, invalid, scope }),
    [instance, registry, disabled, invalid, scope],
  )
  const props = mergeProps(
    {
      ...normalizeProps(api.root()),
      ...(id === undefined ? {} : { id }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return (
    <FieldsetScopeContext value={scope}>
      <PartsContext value={parts}>
        {renderPart("fieldset", props, render, { disabled, invalid })}
      </PartsContext>
    </FieldsetScopeContext>
  )
}

function useApi(ctx: PartsCtx) {
  return fieldsetConnect({
    instance: ctx.instance,
    disabled: ctx.disabled,
    invalid: ctx.invalid,
    rootTag: "fieldset",
    nativeLegend: true,
    ids: {},
  })
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<FieldsetState>
}

function Legend({ render, id, ...rest }: PartProps<"legend">) {
  const ctx = useParts("Legend")
  const env = useEnvironment()
  const own = id ?? partId("fieldset", ctx.instance, "legend")
  useRegisterPart(ctx.registry, "legend", own)
  const el = useRef<HTMLElement | null>(null)
  // HTML exempts only the fieldset's first <legend> child. The server assumes the default
  // markup (first); after commit the real position decides.
  const [first, setFirst] = useState(true)
  useIsoLayoutEffect(() => {
    const node = el.current
    const legend = node?.parentElement
      ? Array.from(node.parentElement.children).find((c) => c.tagName === "LEGEND")
      : undefined
    setFirst(node?.tagName === "LEGEND" && legend === node)
  })
  // A legend activates nothing: only the label double-click selection guard.
  const { onMouseDown } = labelInteraction(env, { target: () => null, forwardsFocus: () => false })
  const props = mergeProps(
    { ...normalizeProps(useApi(ctx).legend(own)), onMouseDown, ref: el },
    rest,
  )
  return (
    // HTML: controls in the first legend are exempt from this Fieldset's disabled state.
    <FieldsetScopeContext value={first ? legendScope(ctx.scope) : ctx.scope}>
      {renderPart("legend", props, render, { disabled: ctx.disabled, invalid: ctx.invalid })}
    </FieldsetScopeContext>
  )
}

function Description({ render, id, ...rest }: PartProps<"p">) {
  const ctx = useParts("Description")
  const own = id ?? partId("fieldset", ctx.instance, "description")
  useRegisterPart(ctx.registry, "description", own)
  const props = mergeProps(normalizeProps(useApi(ctx).description(own)), rest)
  return renderPart("p", props, render, { disabled: ctx.disabled, invalid: ctx.invalid })
}

function ErrorMessage({
  render,
  id,
  forceMount = false,
  ...rest
}: PartProps<"p"> & { readonly forceMount?: boolean }) {
  const ctx = useParts("ErrorMessage")
  if (!ctx.invalid && !forceMount) return null
  return <ErrorMessageShown ctx={ctx} render={render} id={id} rest={rest} />
}

/** Split out so its hooks run only while the message is rendered. */
function ErrorMessageShown({
  ctx,
  render,
  id,
  rest,
}: {
  readonly ctx: PartsCtx
  readonly render: RenderProp<FieldsetState> | undefined
  readonly id: string | undefined
  readonly rest: Record<string, unknown>
}) {
  const own = id ?? partId("fieldset", ctx.instance, "error-message")
  useRegisterPart(ctx.registry, "error-message", own)
  const props = mergeProps(normalizeProps(useApi(ctx).errorMessage(own)), rest)
  return renderPart("p", props, render, { disabled: ctx.disabled, invalid: ctx.invalid })
}

/** The parts, by name: `fieldset.parts.ts` re-exports them as the `Fieldset` namespace. */
export { Description, ErrorMessage, Legend, Root }
