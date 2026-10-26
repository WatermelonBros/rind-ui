// Citation (add-citation): a numbered marker that previews its source in a Hover Card. The card's
// open/close, delays and positioning are Hover Card's, with `open` = pinned || hover-open; the
// Citation machine owns `pinned` (a press on a button marker). A link marker follows its link.

import {
  type CitationMessages,
  type CitationSource,
  citationConnect,
  citationMachine,
  citationMessages,
  type HoverCardChangeDetails,
  type MessageOverrides,
  type PartProps,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import * as HoverCard from "../hover-card/hover-card.parts"
import { joinHandlers } from "../join-handlers"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    citation: CitationMessages
  }
}

/** What every part's slot receives. */
export interface CitationRenderState {
  readonly open: boolean
  readonly pinned: boolean
  readonly kind: "link" | "button" | "pending"
}

type Api = ReturnType<typeof citationConnect>

interface Ctx {
  readonly api: () => Api
  readonly state: () => CitationRenderState
  readonly source: () => CitationSource | undefined
  readonly press: () => void
}
const CitationKey: InjectionKey<Ctx> = Symbol("rind-ui.citation")
function useCitation(part: string): Ctx {
  const ctx = inject(CitationKey, null)
  if (!ctx) throw new Error(`Citation.${part} must be inside Citation.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: CitationRenderState) => VNodeChild }>

const CLOSES = new Set(["escape-key", "outside-press", "outside-focus", "parent-dismissed"])

const Root = defineComponent({
  name: "CitationRoot",
  props: {
    /** The source; absent while it streams (the marker is pending text). */
    source: Object as PropType<CitationSource>,
    /** Required. The number the marker shows. */
    index: { type: Number, required: true },
    /** Where the link opens. Default "_self". */
    target: { type: String as PropType<"_self" | "_blank">, default: "_self" },
    /** Hover delay before opening (ms). Default 300. */
    openDelay: { type: Number, default: 300 },
    /** Delay before closing (ms). Default 200. */
    closeDelay: { type: Number, default: 200 },
    messages: Object as PropType<MessageOverrides<CitationMessages>>,
    /** Default: the provider's locale. */
    locale: String,
    /** Base for the ids of the card's parts. Default: generated. */
    id: String,
  },
  emits: {
    /** A button marker was pressed. */
    pinnedChange: (_pinned: boolean) => true,
  },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { slots, emit }) {
    const instance = useRootId(() => props.id)
    const messages = useMessages("citation", citationMessages, () => props.messages)
    const hoverOpen = shallowRef(false)
    const connect = (open: boolean, pinned: boolean) =>
      citationConnect({
        instance: instance(),
        index: props.index,
        source: props.source,
        open,
        pinned,
        target: props.target,
        messages: messages.value,
      })
    const { view, send } = useMachine(
      citationMachine,
      () => ({
        kind: connect(false, false).kind === "link" ? ("link" as const) : ("button" as const),
        onPinnedChange: (p: boolean) => emit("pinnedChange", p),
      }),
      {},
    )
    const pinned = () => view.value.state === "pinned"
    const api = computed(() => connect(hoverOpen.value, pinned()))
    const open = () => props.source !== undefined && (pinned() || hoverOpen.value)
    const state = (): CitationRenderState => ({
      open: open(),
      pinned: pinned(),
      kind: api.value.kind,
    })
    provide(CitationKey, {
      api: () => api.value,
      state,
      source: () => props.source,
      press: () => send({ type: "PRESS" }),
    })
    return () =>
      h(
        HoverCard.Root,
        {
          id: instance(),
          open: open(),
          openDelay: props.openDelay,
          closeDelay: props.closeDelay,
          disabled: props.source === undefined,
          onOpenChange: (next: boolean, details: HoverCardChangeDetails) => {
            hoverOpen.value = next
            // Escape, an outside press or a dismissal closes a pinned card too.
            if (!next && CLOSES.has(details.reason)) send({ type: "UNPIN" })
          },
        },
        () => slots.default?.(),
      )
  },
})

/**
 * The marker: a link for an http(s) source, else a button that pins the card; named "Source 1:
 * title". Plain text while the source is pending.
 */
const Trigger = defineComponent({
  name: "CitationTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCitation("Trigger")
    return () => {
      const api = ctx.api()
      // Hover Card owns `aria-expanded` on its trigger (open = pinned || hover): not overridden.
      const { "aria-expanded": _expanded, ...own } = normalizeProps(api.trigger())
      // No children: the marker's own text (its index), so it is never an empty link.
      const children = slots.default?.(ctx.state()) ?? api.markerText
      if (api.kind === "pending")
        return renderPart("span", mergeProps(own, attrs), children, props.asChild)
      const merged = mergeProps(
        joinHandlers(own, {
          onClick: () => {
            if (ctx.api().kind === "button") ctx.press()
          },
        }),
        attrs,
      )
      if (api.kind === "button" && !props.asChild) {
        return h(HoverCard.Trigger, { ...merged, asChild: true }, () =>
          h("button", { type: "button" }, [children]),
        )
      }
      return h(HoverCard.Trigger, { ...merged, asChild: props.asChild }, () => children)
    }
  },
})

/** A part whose default content comes from the source. */
function sourcePart(
  name: string,
  tag: "div" | "p" | "span" | "a",
  own: (api: Api) => PartProps,
  text: (ctx: Ctx) => string | undefined | null,
) {
  return defineComponent({
    name: `Citation${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useCitation(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(own(ctx.api())), attrs),
          slots.default?.(ctx.state()) ?? text(ctx),
          props.asChild,
        )
    },
  })
}

/** One source. */
const Source = sourcePart(
  "Source",
  "div",
  (a) => a.source(),
  () => null,
)
/** Its title. */
const SourceTitle = sourcePart(
  "SourceTitle",
  "p",
  (a) => a.sourceTitle(),
  (c) => c.source()?.title,
)
/** Its domain. */
const SourceUrl = sourcePart(
  "SourceUrl",
  "span",
  (a) => a.sourceUrl(),
  (c) => c.api().domain,
)
/** The quoted passage. */
const SourceSnippet = sourcePart(
  "SourceSnippet",
  "span",
  (a) => a.sourceSnippet(),
  (c) => c.source()?.snippet,
)
/** The link to the source. */
const SourceLink = sourcePart(
  "SourceLink",
  "a",
  (a) => a.sourceLink(),
  (c) => c.api().href,
)
/** The words the citation supports (`data-state` follows the card). */
const CitedText = sourcePart(
  "CitedText",
  "span",
  (a) => a.citedText(),
  () => null,
)

/** The parts, by name: `citation.parts.ts` re-exports them as the `Citation` namespace. */
export { CitedText, Root, Source, SourceLink, SourceSnippet, SourceTitle, SourceUrl, Trigger }
