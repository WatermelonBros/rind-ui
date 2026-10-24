/** @jsxImportSource solid-js */
import {
  type HeadingLevel,
  headingConnect,
  nextHeadingLevel,
  resolveHeadingLevel,
  tooDeep,
  warnEmptyHeading,
  warnTooDeep,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  splitProps,
  useContext,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"

/** The raw (unclamped) level of the nearest `Heading.Level`; Solid context crosses portals. */
const HeadingLevelContext = createContext<Accessor<number | undefined>>()

/** The level a heading gets at this position in the component tree (1–6). */
export function useHeadingLevel(): Accessor<HeadingLevel> {
  const context = useContext(HeadingLevelContext)
  return () => resolveHeadingLevel(undefined, context?.())
}

/** The level the nearest `Heading.Level` gives (unclamped), or undefined outside any. */
export function useHeadingContextLevel(): Accessor<number | undefined> {
  const context = useContext(HeadingLevelContext)
  return () => context?.()
}

export interface HeadingLevelProps {
  /** The level for the headings below; default: one more than the level around it. */
  readonly level?: HeadingLevel | undefined
  readonly children?: JSX.Element
}

/** A section: sets the level of the headings below it. Renders no element. */
function HeadingLevelSection(props: HeadingLevelProps) {
  const parent = useContext(HeadingLevelContext)
  const level = () => nextHeadingLevel(parent?.(), props.level)
  return <HeadingLevelContext.Provider value={level}>{props.children}</HeadingLevelContext.Provider>
}

export interface HeadingState {
  readonly level: HeadingLevel
}

export type HeadingProps = Omit<JSX.HTMLAttributes<HTMLHeadingElement>, "children"> & {
  /** Overrides the level from the nesting. */
  readonly level?: HeadingLevel | undefined
  readonly render?: RenderProp<HeadingState> | undefined
  readonly children?: JSX.Element
}

function HeadingRoot(props: HeadingProps) {
  const [local, rest] = splitProps(props, ["level", "render", "id", "children"])
  const context = useContext(HeadingLevelContext)
  const level = createMemo(() => resolveHeadingLevel(local.level, context?.()))
  const instance = useRootId(() => local.id)
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = () => (local.render ? (el()?.tagName.toLowerCase() ?? `h${level()}`) : `h${level()}`)
  afterMount(() => {
    let warnedDeep = false
    createEffect(() => {
      const ctx = context?.()
      if (local.level === undefined && tooDeep(ctx) && ctx !== undefined && !warnedDeep) {
        warnedDeep = true
        warnTooDeep(ctx)
      }
    })
    createEffect(() => {
      level()
      const node = el()
      if (node) warnEmptyHeading(node)
    })
  })
  const state = reactive<HeadingState>(() => ({ level: level() }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(headingConnect({ level: level(), tag: tag(), instance: instance() })),
        ...(local.id === undefined ? {} : { id: local.id }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => (
    <Dynamic component={`h${level()}`} {...p}>
      {children()}
    </Dynamic>
  ))
}

/** A heading whose level follows the nesting of `Heading.Level` sections (default 2). */
export const Heading = Object.assign(HeadingRoot, { Level: HeadingLevelSection })
