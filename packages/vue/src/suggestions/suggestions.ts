// Suggestions (add-suggestions): a named group of buttons. The Root reports the rendered items'
// keys (ITEMS) and each press (PRESS); the machine calls onSelect and moves the focus.
import {
  announcerCapability,
  type MessageOverrides,
  type SuggestionsEvent,
  type SuggestionsMessages,
  type SuggestionsSelectDetails,
  type SuggestionsState,
  suggestionsConnect,
  suggestionsMachine,
  suggestionsMessages,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  useId,
  type VNodeChild,
  watch,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    suggestions: SuggestionsMessages
  }
}

/** What every part's default slot receives. */
export interface SuggestionsRenderState {
  readonly state: SuggestionsState
  readonly count: number
}

interface Entry {
  readonly el: Element
  readonly key: string
}

interface Ctx {
  readonly api: () => ReturnType<typeof suggestionsConnect>
  readonly state: () => SuggestionsRenderState
  readonly send: (event: SuggestionsEvent) => void
  readonly register: (id: string, entry: Entry) => () => void
  readonly indexOf: (id: string) => number
  readonly root: () => Element | null
}
const SuggestionsKey: InjectionKey<Ctx> = Symbol("rind-ui.suggestions")
function useSuggestions(part: string): Ctx {
  const ctx = inject(SuggestionsKey, null)
  if (!ctx) throw new Error(`Suggestions.${part} must be inside Suggestions.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: SuggestionsRenderState) => VNodeChild }>

/** DOM order: the items' indexes and the reported keys follow the rendered order. */
const byDocument = (a: Entry, b: Entry) =>
  a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1

const Root = defineComponent({
  name: "SuggestionsRoot",
  inheritAttrs: false,
  props: {
    /** The items stay, disabled and focusable; the group is busy. */
    loading: Boolean,
    /** No press does anything. */
    disabled: Boolean,
    /** Announce a new set ("3 suggestions"); never on mount. Default "off". */
    announce: String as PropType<"off" | "polite">,
    /** Where the focus goes after a press that began inside (the prompt). */
    focusTarget: Function as PropType<() => { focus(): void } | null>,
    messages: Object as PropType<MessageOverrides<SuggestionsMessages>>,
    /** Default: the provider's locale. */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    /**
     * A press (`onSelect`): put the value in the prompt, or send it. Not `select`: a `@select`
     * listener also hears the native select event bubbling up.
     */
    pick: (_details: SuggestionsSelectDetails) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability)
    const messages = useMessages("suggestions", suggestionsMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const { view, send } = useMachine(
      suggestionsMachine,
      () => ({
        loading: props.loading,
        disabled: props.disabled,
        announce: props.announce,
        onSelect: (d: SuggestionsSelectDetails) => emit("pick", d),
        focusTarget: () => props.focusTarget?.() ?? null,
        messages: messages.value,
        id: instance(),
        lang: locale.value.locale,
      }),
      env,
    )
    const entries = shallowRef<ReadonlyMap<string, Entry>>(new Map())
    const ordered = computed(() =>
      [...entries.value.entries()].sort(([, a], [, b]) => byDocument(a, b)),
    )
    const rootEl = shallowRef<Element | null>(null)
    const api = computed(() =>
      suggestionsConnect(
        {
          instance: instance(),
          state: view.value.state,
          count: ordered.value.length,
          messages: messages.value,
          named: attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined,
        },
        env,
      ),
    )
    const state = (): SuggestionsRenderState => ({
      state: view.value.state,
      count: ordered.value.length,
    })
    onMounted(() => {
      // The rendered keys, in order, once per change: items register one by one (on mount, and
      // when a new set replaces the old one), so the report waits for the end of that microtask.
      // The first report is then the whole first set, never announced.
      let pending = false
      watch(
        ordered,
        () => {
          if (pending) return
          pending = true
          queueMicrotask(() => {
            pending = false
            send({ type: "ITEMS", keys: ordered.value.map(([, e]) => e.key) })
          })
        },
        { immediate: true },
      )
    })
    provide(SuggestionsKey, {
      api: () => api.value,
      state,
      send,
      register: (id, entry) => {
        entries.value = new Map(entries.value).set(id, entry)
        return () => {
          const next = new Map(entries.value)
          next.delete(id)
          entries.value = next
        }
      },
      indexOf: (id) => ordered.value.findIndex(([k]) => k === id),
      root: () => rootEl.value,
    })
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(api.value.root()),
            ref: refTo(rootEl),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

const Item = defineComponent({
  name: "SuggestionsItem",
  inheritAttrs: false,
  props: {
    /** What `pick` receives; default: the Label's text (else the item's text). */
    value: String,
    /** This suggestion does nothing (stays focusable). */
    disabled: Boolean,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSuggestions("Item")
    const id = useId()
    const key = () => props.value ?? id
    const env = useEnvironment()
    // Tracks the modality from mount, so the first keyboard focus is already visible.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    onMounted(() => {
      let off: (() => void) | undefined
      watch(
        [el, key],
        ([node, k]) => {
          off?.()
          off = node ? ctx.register(id, { el: node, key: k }) : undefined
        },
        { immediate: true },
      )
      onBeforeUnmount(() => off?.())
    })
    // Where the focus was when the press began (a pointer press moves it onto the item).
    let wasInside = false
    const begin = () => {
      const active = el.value?.ownerDocument.activeElement ?? null
      wasInside = active !== null && ctx.root()?.contains(active) === true
    }
    return () => {
      const children = slots.default?.(ctx.state())
      const tag = renderedTag("button", children, props.asChild, measured.value)
      const native = tag === "button" || tag === "input"
      const api = normalizeProps(
        ctx.api().item({
          key: key(),
          index: ctx.indexOf(id),
          disabled: props.disabled,
          tag,
          focused: focused.value,
          modality: modality.value,
        }),
      )
      return renderPart(
        "button",
        mergeProps(
          {
            ...joinHandlers(api, {
              onPointerdown: begin,
              onClick: (e: MouseEvent) => {
                // A click without a pointerdown (keyboard, assistive technology): the focus is
                // where it is now.
                if (e.detail === 0) begin()
                const node = e.currentTarget as HTMLElement
                const label = node.querySelector('[data-scope="suggestions"][data-part="label"]')
                ctx.send({
                  type: "PRESS",
                  key: key(),
                  value: props.value ?? (label ?? node).textContent?.trim() ?? "",
                  index: ctx.indexOf(id),
                  itemDisabled: props.disabled,
                  focusWasInside: wasInside,
                })
                wasInside = false
              },
              // A substituted non-button element: Enter and Space click it, as a button would.
              onKeydown: (e: KeyboardEvent) => {
                if (native || e.repeat) return
                if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
                if (e.key === " ") e.preventDefault()
              },
              onKeyup: (e: KeyboardEvent) => {
                if (!native && e.key === " ") (e.currentTarget as HTMLElement).click()
              },
              onFocusin: () => (focused.value = true),
              onFocusout: () => (focused.value = false),
            }),
            ref: refTo(el),
          },
          attrs,
        ),
        children,
        props.asChild,
      )
    }
  },
})

/** A part rendering `tag` with the connect props `own(ctx)`, and the state in its slot. */
function part(name: string, tag: string, own: (ctx: Ctx) => Record<string, unknown>) {
  return defineComponent({
    name: `Suggestions${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useSuggestions(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(own(ctx) as never), attrs),
          slots.default?.(ctx.state()),
          props.asChild,
        )
    },
  })
}

/** The main text. */
const Label = part("Label", "span", (ctx) => ctx.api().label())
/** Secondary text, part of the Item's name. */
const Description = part("Description", "span", (ctx) => ctx.api().description())

/** The parts, by name: `suggestions.parts.ts` re-exports them as the `Suggestions` namespace. */
export { Description, Item, Label, Root }
