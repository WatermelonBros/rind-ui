/** @jsxImportSource solid-js */
import {
  droppedNameProps,
  type SeparatorContext,
  type SeparatorInput,
  type SeparatorOrientation,
  separatorProps,
  separatorWarnings,
} from "@rind-ui/core"
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"

/**
 * What a container tells the separators inside it (a Toolbar: context `toolbar`, the
 * perpendicular default orientation; a listbox popup: `listbox`).
 */
export interface SeparatorHost {
  readonly context: SeparatorContext
  readonly defaultOrientation?: SeparatorOrientation | undefined
}
export const SeparatorHostContext = createContext<SeparatorHost | null>(null)

export interface SeparatorState {
  readonly orientation: SeparatorOrientation
  readonly decorative: boolean
}

export type SeparatorProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Default: the container's, else `horizontal`. */
  readonly orientation?: SeparatorOrientation | undefined
  /** Purely visual: `role="none"`, removed from the accessibility tree. */
  readonly decorative?: boolean | undefined
  /** Ignored when the rendered element is void (`<hr>`). */
  readonly children?: JSX.Element
  readonly render?: RenderProp<SeparatorState> | undefined
}

const VOID = new Set(["hr", "br", "img", "input", "wbr"])

function Root(props: SeparatorProps) {
  const [local, rest] = splitProps(props, ["orientation", "decorative", "render", "id", "children"])
  const host = useContext(SeparatorHostContext)
  const instance = useRootId(() => local.id)
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = () => (local.render ? (el()?.tagName.toLowerCase() ?? "div") : "div")
  const input = createMemo(
    (): SeparatorInput => ({
      orientation: local.orientation,
      defaultOrientation: host?.defaultOrientation,
      decorative: local.decorative === true,
      tag: tag(),
      context: host?.context ?? "content",
      instance: instance(),
      // The element's own props, read by name.
      own: rest as Readonly<Record<string, unknown>>,
    }),
  )
  // Warn once per change of what the warnings read, not on every render.
  const warnKey = createMemo(() =>
    JSON.stringify([
      local.orientation,
      local.decorative === true,
      host?.context ?? "content",
      rest.tabIndex,
      rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
    ]),
  )
  afterMount(() =>
    createEffect(() => {
      if (warnKey()) separatorWarnings(untrack(input))
    }),
  )
  const own = createMemo(() => normalizeProps(separatorProps(input())))
  const merged = createMemo(() => {
    const consumer: Record<string, unknown> = { ...rest }
    for (const name of droppedNameProps(input())) delete consumer[name]
    return mergeProps(
      { ...own(), ...(local.id === undefined ? {} : { id: local.id }), ref: setEl },
      consumer,
    )
  })
  const state = reactive<SeparatorState>(() => ({
    // Set by separatorProps.
    orientation: own()["data-orientation"] as SeparatorOrientation,
    decorative: own()["data-decorative"] !== undefined,
  }))
  const children = () => (VOID.has(tag()) ? undefined : local.children)
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

/** A static divider between groups of content or controls; never focusable. */
/** The parts, by name: `separator.parts.ts` re-exports them as the `Separator` namespace. */
export { Root }
