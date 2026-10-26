// Mentions parts (add-mentions): wiring only. The machine reconciles every input from the text
// before and after it; here the textarea reports input, caret moves and composition, the list
// parts are the listbox parts under scope "mentions" (as Combobox), and the Highlighter mirrors
// the text with the mentions painted.
import {
  announcerCapability,
  type ChangeDetails,
  type Collection,
  type CollectionKey,
  type ComboboxFilter,
  caretRect,
  createListCollection,
  domPositioning,
  isEmptyState,
  type LoadingStatus,
  layoutCapability,
  type MentionRange,
  type MentionsEvent,
  type MentionsMessages,
  type MentionsQuery,
  type MentionsSelectDetails,
  type MentionTrigger,
  type MessageOverrides,
  mentionsConnect,
  mentionsIds,
  mentionsMachine,
  mentionsMessages,
  type PositioningProps,
  patternResults,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  nextTick,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { createPopupParts } from "../combobox/popup-parts"
import { joinHandlers } from "../join-handlers"
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    mentions: MentionsMessages
  }
}

const EMPTY = createListCollection({ items: [] as string[], getKey: (s) => s, getText: (s) => s })

/** What every part's slot receives. */
export interface MentionsRenderState {
  readonly open: boolean
  /** The trigger id at the caret, null when closed. */
  readonly trigger: string | null
  /** The text typed after the trigger. */
  readonly query: string
}

type Api = ReturnType<typeof mentionsConnect>

interface Host {
  readonly api: () => Api
  readonly state: () => MentionsRenderState
  readonly send: (event: MentionsEvent) => void
  readonly open: () => boolean
  readonly highlightedKey: () => CollectionKey | null
  readonly keepMounted: () => boolean
  readonly setPresent: (present: boolean) => void
  readonly topLayer: () => boolean
  readonly textarea: ShallowRef<HTMLTextAreaElement | null>
  readonly highlighter: ShallowRef<HTMLElement | null>
  readonly selectOnTab: () => boolean
}

const HostKey: InjectionKey<Host> = Symbol("rind-ui.mentions")
const ListKey: InjectionKey<ListboxHost> = Symbol("rind-ui.mentions-listbox")
function useHost(part: string): Host {
  const host = inject(HostKey, null)
  if (!host) throw new Error(`Mentions.${part} must be inside Mentions.Root`)
  return host
}

type Slots = SlotsType<{ default?: (state: MentionsRenderState) => VNodeChild }>

/** A textarea suggesting people, tags or commands at a trigger character. */
const Root = defineComponent({
  name: "MentionsRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** Controlled text (`v-model`). */
    modelValue: { type: String, default: undefined },
    /** Uncontrolled text. Default "". */
    defaultValue: { type: String, default: undefined },
    /** Controlled mention ranges (`v-model:mentions`). */
    mentions: Array as PropType<readonly MentionRange[]>,
    /** Uncontrolled mention ranges. */
    defaultMentions: Array as PropType<readonly MentionRange[]>,
    /** `{ char, id?, behavior?: "insert" | "action", startOfInput?, allowSpaces?, appendSpace? }`. */
    triggers: { type: Array as PropType<readonly MentionTrigger[]>, required: true },
    /** The options for the current query (default: the Item parts, filtered by the query). */
    items: Object as PropType<Collection<unknown>>,
    /** The matcher for the Item parts; `null` lists them unfiltered. */
    filter: { type: [Function, null] as PropType<ComboboxFilter | null>, default: undefined },
    /** The inserted label (default: the trigger char and the text). */
    formatLabel: Function as PropType<
      (item: { readonly key: string; readonly text: string }, trigger: string) => string
    >,
    /** Tab inserts the highlighted option. Default true. */
    selectOnTab: { type: Boolean, default: true },
    /** Results are loading. */
    loading: String as PropType<LoadingStatus>,
    /** No editing; the list never opens. */
    readOnly: Boolean,
    /** Not editable or submitted. */
    disabled: Boolean,
    /** The list's placement at the trigger (default: below, flipping). */
    positioning: Object as PropType<PositioningProps>,
    /** The list stays mounted (hidden) while closed. */
    keepMounted: Boolean,
    /** Overrides the strings (also through the provider). */
    messages: Object as PropType<MessageOverrides<MentionsMessages>>,
  },
  emits: {
    /** Every change of the text. */
    valueChange: (_v: string, _d: ChangeDetails<MentionsEvent>) => true,
    "update:modelValue": (_v: string) => true,
    /** Mentions added, moved or removed. */
    mentionsChange: (_m: readonly MentionRange[], _d: ChangeDetails<MentionsEvent>) => true,
    "update:mentions": (_m: readonly MentionRange[]) => true,
    /** The trigger and query at the caret; null when it closes. */
    queryChange: (_q: MentionsQuery | null) => true,
    /** An "action" trigger's choice. */
    select: (_d: MentionsSelectDetails) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const base = useEnvironment(announcerCapability, layoutCapability)
    const messages = useMessages("mentions", mentionsMessages, () => props.messages)
    const textarea = shallowRef<HTMLTextAreaElement | null>(null)
    const highlighter = shallowRef<HTMLElement | null>(null)
    // The caret the machine asked for: placed after the value it wrote is rendered.
    let caret: number | null = null
    const placeCaret = () => {
      const el = textarea.value
      if (!el || caret === null) return
      const c = caret
      caret = null
      el.setSelectionRange(c, c)
    }
    const env = {
      ...base,
      position: domPositioning(base),
      setCaret: (c: number) => {
        caret = c
        void nextTick(placeCaret)
      },
    }
    const { collection: registered, registry } = useCollectionItems()
    const query = shallowRef<MentionsQuery | null>(null)
    const locale = () => base.locale.locale()
    const full = () => props.items ?? registered.value ?? EMPTY
    const results = computed(() =>
      props.items
        ? props.items
        : patternResults(full(), query.value?.query ?? "", props.filter, locale()),
    )
    const ids = mentionsIds(instance())
    let svc: { view(): { context: { match: { start: number } | null } } } | null = null
    const machineProps = () => ({
      root: instance(),
      ids,
      strategy: "active-descendant" as const,
      collection: results.value,
      loading: props.loading,
      positioning: props.positioning,
      messages: messages.value,
      triggers: props.triggers,
      value: props.modelValue,
      defaultValue: props.defaultValue,
      onValueChange: (v: string, d: ChangeDetails<MentionsEvent>) => {
        emit("valueChange", v, d)
        emit("update:modelValue", v)
      },
      mentions: props.mentions,
      defaultMentions: props.defaultMentions,
      onMentionsChange: (m: readonly MentionRange[], d: ChangeDetails<MentionsEvent>) => {
        emit("mentionsChange", m, d)
        emit("update:mentions", m)
      },
      onQueryChange: (q: MentionsQuery | null) => {
        query.value = q
        emit("queryChange", q)
      },
      onSelect: (d: MentionsSelectDetails) => emit("select", d),
      formatLabel: props.formatLabel,
      selectOnTab: props.selectOnTab,
      readOnly: props.readOnly,
      disabled: props.disabled,
      anchor: () => {
        const el = textarea.value
        const m = svc?.view().context.match
        if (!el || !m) return null
        const r = caretRect(el, m.start)
        return {
          getBoundingClientRect: () => ({
            x: r.left,
            y: r.top,
            left: r.left,
            top: r.top,
            width: 0,
            height: r.height,
            right: r.left,
            bottom: r.top + r.height,
          }),
        }
      },
    })
    const { view, service, send } = useMachine(mentionsMachine, machineProps, env)
    svc = service
    onMounted(placeCaret)
    onUpdated(placeCaret)
    const present = shallowRef(false)
    // Known after mount: the server render and hydration never carry `popover`.
    const topLayer = shallowRef(false)
    onMounted(() => {
      topLayer.value = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype
    })
    const mounted = shallowRef<{
      label: boolean
      empty: boolean
      descriptions: ReadonlySet<CollectionKey>
    }>({ label: false, empty: false, descriptions: new Set() })
    const modality = useModality(base.modality, () => view.value.context.focused)
    const open = () => view.value.matches("open")
    const exposure = () => ({
      open: open(),
      results: results.value,
      query: view.value.context.match?.query ?? "",
      loading: props.loading,
    })
    const api = computed(() => {
      const v = view.value
      const m = mounted.value
      return mentionsConnect(
        {
          instance: instance(),
          open: v.matches("open"),
          empty: isEmptyState(exposure()),
          results: results.value,
          context: v.context,
          disabled: props.disabled,
          loading: props.loading,
          modality: modality.value,
          dir: base.locale.dir(),
          mounted: {
            label: m.label,
            empty: m.empty,
            description: (key) => m.descriptions.has(key),
          },
          topLayer: topLayer.value,
          blur: () => send({ type: "INPUT.BLUR" }),
          value: v.values.value ?? "",
          mentions: v.values.mentions ?? [],
          match: v.context.match,
          triggers: props.triggers.map((t) => t.char),
          readOnly: props.readOnly,
          composing: v.context.composing,
          messages: messages.value,
          send,
        },
        env,
      )
    })
    const state = (): MentionsRenderState => ({
      open: open(),
      trigger: view.value.context.match?.trigger ?? null,
      query: view.value.context.match?.query ?? "",
    })
    provide(HostKey, {
      api: () => api.value,
      state,
      send,
      open,
      highlightedKey: () => view.value.context.highlightedKey,
      keepMounted: () => props.keepMounted,
      setPresent: (p) => (present.value = p),
      topLayer: () => topLayer.value,
      textarea,
      highlighter,
      selectOnTab: () => props.selectOnTab,
    })
    provide(ListKey, {
      name: "Mentions",
      // Sound: the mentions api has every listbox part the shared parts call.
      parts: () =>
        ({ ...api.value, isEmpty: isEmptyState(exposure()) }) as unknown as ReturnType<
          ListboxHost["parts"]
        >,
      collection: () => results.value,
      registry: props.items ? null : registry,
      listed: (key) => results.value.has(key),
      mount: (part, on) => {
        if (mounted.value[part] !== on) mounted.value = { ...mounted.value, [part]: on }
      },
      mountDescription: (key, on) => {
        if (mounted.value.descriptions.has(key) === on) return
        const next = new Set(mounted.value.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        mounted.value = { ...mounted.value, descriptions: next }
      },
      requestLoadMore: () => {},
    })
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(api.value.root()), attrs),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

/** The text field: a textbox, a combobox while its list is open. */
const Textarea = defineComponent({
  name: "MentionsTextarea",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const host = useHost("Textarea")
    // The value is the textarea's content (React's markup) and, written after each render, its
    // property (what shows once the user edited it); the Root places the caret after this.
    const sync = () => {
      const el = host.textarea.value
      const v = String(host.api().textarea()["value"] ?? "")
      if (el && el.value !== v) el.value = v
    }
    onMounted(sync)
    onUpdated(sync)
    const at = (el: HTMLTextAreaElement) => el.selectionStart ?? el.value.length
    const caretOf = (e: Event) => ({
      type: "CARET" as const,
      caret: at(e.currentTarget as HTMLTextAreaElement),
    })
    return () => {
      const { value, ...own } = normalizeProps(host.api().textarea())
      return renderPart(
        "textarea",
        mergeProps(
          {
            ...joinHandlers(own, {
              onInput: (e: Event) => {
                const el = e.currentTarget as HTMLTextAreaElement
                host.send({
                  type: "INPUT",
                  value: el.value,
                  caret: at(el),
                  composing: (e as InputEvent).isComposing === true,
                })
              },
              onSelect: (e: Event) => host.send(caretOf(e)),
              onClick: (e: Event) => host.send(caretOf(e)),
              onKeyup: (e: KeyboardEvent) => {
                // Only caret keys: an input already reported its caret.
                if (/^(Arrow|Home|End|Page)/.test(e.key) && !host.open()) host.send(caretOf(e))
              },
              onCompositionstart: () => host.send({ type: "COMPOSITION.START" }),
              onCompositionend: (e: CompositionEvent) => {
                const el = e.currentTarget as HTMLTextAreaElement
                host.send({ type: "COMPOSITION.END", value: el.value, caret: at(el) })
              },
              onKeydown: (e: KeyboardEvent) => {
                // Closed: the textarea's own keys (no interception).
                if (!host.open()) return
                const composing = e.isComposing || e.keyCode === 229
                if (composing) return
                const highlighted = host.highlightedKey() !== null
                switch (e.key) {
                  case "ArrowDown":
                  case "ArrowUp":
                    e.preventDefault()
                    host.send({
                      type: "ARROW",
                      key: e.key === "ArrowDown" ? "NEXT" : "PREV",
                      alt: e.altKey,
                      composing,
                    })
                    return
                  case "Enter":
                    if (!highlighted) return
                    e.preventDefault()
                    host.send({ type: "ENTER", composing })
                    return
                  case "Tab":
                    // Tab inserts only a highlighted option; otherwise focus moves on.
                    if (!host.selectOnTab() || !highlighted) return
                    e.preventDefault()
                    host.send({ type: "TAB", composing })
                    return
                  case "Escape":
                    e.preventDefault()
                    // The list closes; a surrounding dialog stays open.
                    e.stopPropagation()
                    host.send({ type: "ESCAPE", composing })
                    return
                }
              },
              onScroll: (e: Event) => {
                const el = e.currentTarget as HTMLTextAreaElement
                const mirror = host.highlighter.value
                if (mirror) {
                  mirror.scrollTop = el.scrollTop
                  mirror.scrollLeft = el.scrollLeft
                }
              },
              onFocus: () => host.send({ type: "INPUT.FOCUS" }),
              onBlur: () => host.send({ type: "INPUT.BLUR" }),
            }),
            ref: refTo(host.textarea),
          },
          attrs,
        ),
        String(value ?? ""),
        props.asChild,
      )
    }
  },
})

/** Names the triggers ("Type @ to insert a mention"); the textarea's description. */
const Description = defineComponent({
  name: "MentionsDescription",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Description")
    return () =>
      renderPart(
        "p",
        mergeProps(normalizeProps(host.api().descriptionPart()), attrs),
        slots.default?.(host.state()) ?? host.api().description,
        props.asChild,
      )
  },
})

/** The text mirrored under the textarea, the mentions painted (hidden from assistive technology). */
const Highlighter = defineComponent({
  name: "MentionsHighlighter",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{
    /** A mention's content (default: its label). */
    mention?: (args: { mention: MentionRange; text: string }) => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const host = useHost("Highlighter")
    return () => {
      const api = host.api()
      const segments = api.segments.map((s) =>
        s.kind === "text"
          ? h("span", null, s.text)
          : h(
              "mark",
              normalizeProps(api.mention(s.mention)),
              slots.mention?.({ mention: s.mention, text: s.text }) ?? s.text,
            ),
      )
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(api.highlighter()), ref: refTo(host.highlighter) }, attrs),
        segments,
        props.asChild,
      )
    }
  },
})

/** Loading content: a sibling of the List, shown while loading. */
const Loading = defineComponent({
  name: "MentionsLoading",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Loading")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(host.api().loading()), attrs),
        slots.default?.(host.state()),
        props.asChild,
      )
  },
})

const { Positioner, Popup } = createPopupParts(
  (part) => ({ ...useHost(part), inline: false }),
  "Mentions",
)
const {
  List,
  Item,
  ItemText,
  Section: Group,
  Empty,
  Items,
} = createListboxParts(ListKey, "Mentions")

export {
  Description,
  Empty,
  Group,
  Highlighter,
  Item,
  Items,
  ItemText,
  List,
  Loading,
  Popup,
  Positioner,
  Root,
  Textarea,
}
