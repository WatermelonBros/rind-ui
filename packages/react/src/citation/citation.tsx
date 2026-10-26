"use client"

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
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useState,
} from "react"
import * as HoverCard from "../hover-card/hover-card.parts"
import { joinHandlers } from "../join-handlers"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
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
  readonly api: Api
  readonly state: CitationRenderState
  readonly source: CitationSource | undefined
  readonly press: () => void
}
const CitationContext = createContext<Ctx | null>(null)
function useCitation(part: string): Ctx {
  const ctx = useContext(CitationContext)
  if (!ctx) throw new Error(`Citation.${part} must be inside Citation.Root`)
  return ctx
}

const CLOSES = new Set(["escape-key", "outside-press", "outside-focus", "parent-dismissed"])

export interface CitationRootProps {
  /** The source; absent while it streams (the marker is pending text). */
  readonly source?: CitationSource
  /** Required. The number the marker shows. */
  readonly index: number
  /** Where the link opens. Default "_self". */
  readonly target?: "_self" | "_blank"
  /** Hover delay before opening (ms). Default 300. */
  readonly openDelay?: number
  /** Delay before closing (ms). Default 200. */
  readonly closeDelay?: number
  /** A button marker was pressed. */
  readonly onPinnedChange?: (pinned: boolean) => void
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<CitationMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
  /** Base for the ids of the card's parts. Default: generated. */
  readonly id?: string
  /** The marker, the card and the cited text. */
  readonly children?: ReactNode
}

function Root({
  source,
  index,
  target = "_self",
  openDelay = 300,
  closeDelay = 200,
  onPinnedChange,
  messages: ownMessages,
  id,
  children,
}: CitationRootProps) {
  const instance = useRootId(id)
  const messages = useMessages("citation", citationMessages, ownMessages)
  const [hoverOpen, setHoverOpen] = useState(false)
  const pending = source === undefined
  const probe = citationConnect({
    instance,
    index,
    source,
    open: false,
    pinned: false,
    target,
    messages,
  })
  const { view, send } = useMachine(
    citationMachine,
    {
      kind: probe.kind === "link" ? "link" : "button",
      onPinnedChange: (p: boolean) => onPinnedChange?.(p),
    },
    {},
  )
  const pinned = view.state === "pinned"
  const open = !pending && (pinned || hoverOpen)
  const api = citationConnect({
    instance,
    index,
    source,
    open: hoverOpen,
    pinned,
    target,
    messages,
  })
  const state: CitationRenderState = { open, pinned, kind: api.kind }
  const ctx: Ctx = { api, state, source, press: () => send({ type: "PRESS" }) }
  return (
    <CitationContext value={ctx}>
      <HoverCard.Root
        id={instance}
        open={open}
        openDelay={openDelay}
        closeDelay={closeDelay}
        disabled={pending}
        onOpenChange={(next, details) => {
          setHoverOpen(next)
          // Escape, an outside press or a dismissal closes a pinned card too.
          if (!next && CLOSES.has(details.reason)) send({ type: "UNPIN" })
        }}
      >
        {children}
      </HoverCard.Root>
    </CitationContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<CitationRenderState>
}

/**
 * The marker: a link for an http(s) source, else a button that pins the card; named "Source 1:
 * title". Plain text while the source is pending.
 */
function Trigger({
  render,
  children,
  ...rest
}: Omit<ComponentPropsWithRef<"a">, "render"> & {
  /** Substitutes the rendered element without changing behaviour. */
  readonly render?: RenderProp<CitationRenderState>
}) {
  const ctx = useCitation("Trigger")
  // Hover Card owns `aria-expanded` on its trigger (open = pinned || hover): not overridden.
  const { "aria-expanded": _expanded, ...own } = normalizeProps(ctx.api.trigger())
  if (ctx.api.kind === "pending") {
    return renderPart(
      "span",
      { ...mergeProps(own, rest), children: children ?? ctx.api.markerText },
      render,
      ctx.state,
    )
  }
  const props = mergeProps(
    joinHandlers(own, {
      onClick: () => {
        if (ctx.api.kind === "button") ctx.press()
      },
    }),
    rest,
  )
  // Sound: a function render receives the Hover Card trigger's props; its state is ours.
  const substitute = (render ??
    (ctx.api.kind === "button" ? <button type="button" /> : undefined)) as
    | RenderProp<{ open: boolean }>
    | undefined
  return (
    <HoverCard.Trigger
      {...(props as ComponentPropsWithRef<"a">)}
      {...(substitute === undefined ? {} : { render: substitute })}
    >
      {children ?? ctx.api.markerText}
    </HoverCard.Trigger>
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

/** A part whose default content comes from the source. */
function textPart<T extends "div" | "p" | "span" | "a">(
  part: string,
  tag: T,
  own: (api: Api) => Record<string, unknown>,
  text: (ctx: Ctx) => ReactNode,
) {
  return function SourcePart({ render, children, ...rest }: PartProps<T>) {
    const ctx = useCitation(part)
    const props = mergeProps(normalizeProps(own(ctx.api) as never), rest)
    return renderPart(tag, { ...props, children: children ?? text(ctx) }, render, ctx.state)
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
  (c) => c.source?.title,
)
/** Its domain. */
const SourceUrl = textPart(
  "SourceUrl",
  "span",
  (a) => a.sourceUrl(),
  (c) => c.api.domain,
)
/** The quoted passage. */
const SourceSnippet = textPart(
  "SourceSnippet",
  "span",
  (a) => a.sourceSnippet(),
  (c) => c.source?.snippet,
)
/** The link to the source. */
const SourceLink = textPart(
  "SourceLink",
  "a",
  (a) => a.sourceLink(),
  (c) => c.api.href,
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
