/** @jsxImportSource solid-js */
// Citation (add-citation): a numbered marker that previews its source in a Hover Card. The card's
// open/close, delays and positioning are Hover Card's, with `open` = pinned || hover-open; the
// Citation machine owns `pinned` (a press on a button marker). A link marker follows its link.
import {
  type CitationMessages,
  type CitationSource,
  citationConnect,
  citationMachine,
  citationMessages,
  type MessageOverrides,
  type PartProps,
} from "@rind-ui/core"
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
import * as HoverCard from "../hover-card/hover-card.parts"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    citation: CitationMessages
  }
}

/** What every part's `render` receives. */
export interface CitationRenderState {
  readonly open: boolean
  readonly pinned: boolean
  readonly kind: "link" | "button" | "pending"
}

type Api = ReturnType<typeof citationConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: CitationRenderState
  readonly source: Accessor<CitationSource | undefined>
  readonly press: () => void
}
const CitationContext = createContext<Ctx>()
function useCitation(part: string): Ctx {
  const ctx = useContext(CitationContext)
  if (!ctx) throw new Error(`Citation.${part} must be inside Citation.Root`)
  return ctx
}

const CLOSES = new Set(["escape-key", "outside-press", "outside-focus", "parent-dismissed"])

export interface CitationRootProps {
  /** The source; absent while it streams (the marker is pending text). */
  readonly source?: CitationSource | undefined
  /** Required. The number the marker shows. */
  readonly index: number
  /** Where the link opens. Default "_self". */
  readonly target?: "_self" | "_blank" | undefined
  /** Hover delay before opening (ms). Default 300. */
  readonly openDelay?: number | undefined
  /** Delay before closing (ms). Default 200. */
  readonly closeDelay?: number | undefined
  /** A button marker was pressed. */
  readonly onPinnedChange?: ((pinned: boolean) => void) | undefined
  readonly messages?: MessageOverrides<CitationMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  /** Base for the ids of the card's parts. Default: generated. */
  readonly id?: string | undefined
  /** The marker, the card and the cited text. */
  readonly children?: JSX.Element
}

function Root(props: CitationRootProps) {
  const instance = useRootId(() => props.id)
  const messages = useMessages("citation", citationMessages, () => props.messages)
  const [hoverOpen, setHoverOpen] = createSignal(false)
  const pending = () => props.source === undefined
  const connect = (open: boolean, pinned: boolean) =>
    citationConnect({
      instance: instance(),
      index: props.index,
      source: props.source,
      open,
      pinned,
      target: props.target ?? "_self",
      messages: messages(),
    })
  const { view, send } = useMachine(
    citationMachine,
    () => ({
      kind: connect(false, false).kind === "link" ? ("link" as const) : ("button" as const),
      onPinnedChange: (p: boolean) => props.onPinnedChange?.(p),
    }),
    {},
  )
  const pinned = () => view().state === "pinned"
  const open = () => !pending() && (pinned() || hoverOpen())
  const api = createMemo(() => connect(hoverOpen(), pinned()))
  const state = reactive<CitationRenderState>(() => ({
    open: open(),
    pinned: pinned(),
    kind: api().kind,
  }))
  const ctx: Ctx = {
    api,
    state,
    source: () => props.source,
    press: () => send({ type: "PRESS" }),
  }
  return (
    <CitationContext.Provider value={ctx}>
      <HoverCard.Root
        id={instance()}
        open={open()}
        openDelay={props.openDelay ?? 300}
        closeDelay={props.closeDelay ?? 200}
        disabled={pending()}
        onOpenChange={(next, details) => {
          setHoverOpen(next)
          // Escape, an outside press or a dismissal closes a pinned card too.
          if (!next && CLOSES.has(details.reason)) send({ type: "UNPIN" })
        }}
      >
        {props.children}
      </HoverCard.Root>
    </CitationContext.Provider>
  )
}

export type CitationTriggerProps = Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & {
  readonly children?: JSX.Element
}

/**
 * The marker: a link for an http(s) source, else a button that pins the card; named "Source 1:
 * title". Plain text while the source is pending.
 */
function Trigger(props: CitationTriggerProps) {
  const ctx = useCitation("Trigger")
  const [local, rest] = splitProps(props, ["children"])
  // Hover Card owns aria-expanded (from its open: pinned || hover); connect's would override it.
  const own = createMemo(() => {
    const { "aria-expanded": _expanded, ...props } = normalizeProps(ctx.api().trigger())
    return props
  })
  const live = reactive(() =>
    mergeProps(
      joinHandlers(own(), {
        onClick: () => {
          if (ctx.api().kind === "button") ctx.press()
        },
      }),
      rest,
    ),
  )
  // No children: the index ("1"), so the marker is never empty.
  const content = () => local.children ?? ctx.api().markerText
  return (
    <Show
      when={ctx.api().kind !== "pending"}
      fallback={<span {...reactive(() => mergeProps(own(), rest))}>{content()}</span>}
    >
      <Show
        when={ctx.api().kind === "button"}
        fallback={<HoverCard.Trigger {...live}>{content()}</HoverCard.Trigger>}
      >
        <HoverCard.Trigger {...live} render={(p) => <button {...p} />}>
          {content()}
        </HoverCard.Trigger>
      </Show>
    </Show>
  )
}

/**
 * Hover Card's portal: a citation sits inside a paragraph, and the card (block content) must
 * not (invalid HTML, a hydration error).
 */
const Portal = HoverCard.Portal
/** Hover Card's positioner. */
const Positioner = HoverCard.Positioner
/** The card: non-modal, reachable with Tab from the marker. */
const Content = HoverCard.Content

type SourcePartProps = Omit<JSX.HTMLAttributes<HTMLElement>, "children"> & {
  readonly render?: RenderProp<CitationRenderState> | undefined
  readonly children?: JSX.Element | ((state: CitationRenderState) => JSX.Element)
}

/** A part whose default content comes from the source. */
function textPart(
  part: string,
  tag: "div" | "p" | "span" | "a",
  own: (api: Api) => PartProps,
  text: (ctx: Ctx) => string | undefined | null,
) {
  return (props: SourcePartProps) => {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useCitation(part)
    const merged = createMemo(() => mergeProps(normalizeProps(own(ctx.api())), rest))
    const children = () => resolveChildren(local.children, ctx.state) ?? text(ctx)
    return renderPart(local.render, merged, ctx.state, children, (p) =>
      tag === "div" ? (
        <div {...p}>{children()}</div>
      ) : tag === "p" ? (
        <p {...p}>{children()}</p>
      ) : tag === "a" ? (
        <a {...p}>{children()}</a>
      ) : (
        <span {...p}>{children()}</span>
      ),
    )
  }
}

/** One source. */
const Source = textPart(
  "Source",
  "div",
  (a) => a.source(),
  () => null,
)
/** Its title. */
const SourceTitle = textPart(
  "SourceTitle",
  "p",
  (a) => a.sourceTitle(),
  (c) => c.source()?.title,
)
/** Its domain. */
const SourceUrl = textPart(
  "SourceUrl",
  "span",
  (a) => a.sourceUrl(),
  (c) => c.api().domain,
)
/** The quoted passage. */
const SourceSnippet = textPart(
  "SourceSnippet",
  "span",
  (a) => a.sourceSnippet(),
  (c) => c.source()?.snippet,
)
/** The link to the source. */
const SourceLink = textPart(
  "SourceLink",
  "a",
  (a) => a.sourceLink(),
  (c) => c.api().href,
)
/** The words the citation supports (`data-state` follows the card). */
const CitedText = textPart(
  "CitedText",
  "span",
  (a) => a.citedText(),
  () => null,
)

/** The parts, by name: `citation.parts.ts` re-exports them as the `Citation` namespace. */
export {
  CitedText,
  Content,
  Portal,
  Positioner,
  Root,
  Source,
  SourceLink,
  SourceSnippet,
  SourceTitle,
  SourceUrl,
  Trigger,
}
