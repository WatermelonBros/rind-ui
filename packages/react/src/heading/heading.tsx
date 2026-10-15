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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useRenderedTag } from "../use-rendered-tag"

/** The raw (unclamped) level of the nearest `Heading.Level`; React context crosses portals. */
const HeadingLevelContext = createContext<number | undefined>(undefined)

/** The level a heading gets at this position in the component tree (1–6). */
export function useHeadingLevel(): HeadingLevel {
  return resolveHeadingLevel(undefined, useContext(HeadingLevelContext))
}

export interface HeadingLevelProps {
  /** The level for the headings below; default: one more than the level around it. */
  readonly level?: HeadingLevel
  readonly children?: ReactNode
}

/** A section: sets the level of the headings below it. Renders no element. */
function HeadingLevelSection({ level, children }: HeadingLevelProps) {
  const parent = useContext(HeadingLevelContext)
  return (
    <HeadingLevelContext value={nextHeadingLevel(parent, level)}>{children}</HeadingLevelContext>
  )
}

export interface HeadingState {
  readonly level: HeadingLevel
}

export type HeadingProps = ComponentPropsWithRef<"h2"> & {
  /** Overrides the level from the nesting. */
  readonly level?: HeadingLevel
  readonly render?: RenderProp<HeadingState>
}

function HeadingRoot({ level: explicit, render, id, ref, ...rest }: HeadingProps) {
  const context = useContext(HeadingLevelContext)
  const level = resolveHeadingLevel(explicit, context)
  const instance = useRootId(id)
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag(`h${level}`, render, el)
  const deep = explicit === undefined && tooDeep(context)
  const warnedDeep = useRef(false)
  useEffect(() => {
    if (deep && context !== undefined && !warnedDeep.current) {
      warnedDeep.current = true
      warnTooDeep(context)
    }
    if (el.current) warnEmptyHeading(el.current)
  })
  const own = normalizeProps(headingConnect({ level, tag, instance }))
  const props = mergeProps(
    { ...own, ...(id === undefined ? {} : { id }), ref: composeRefs(el, ref) },
    rest,
  )
  return renderPart(`h${level}`, props, render, { level })
}

/** A heading whose level follows the nesting of `Heading.Level` sections (default 2). */
export const Heading = Object.assign(HeadingRoot, { Level: HeadingLevelSection })
