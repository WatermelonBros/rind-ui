/** @jsxImportSource solid-js */
// Suggestions (add-suggestions): a named group of buttons. The Root reports the rendered items'
// keys (ITEMS) and each press (PRESS); the machine calls onSelect and moves the focus.
import {
  announcerCapability,
  type MessageOverrides,
  type SuggestionsMessages,
  type SuggestionsSelectDetails,
  type SuggestionsState,
  suggestionsConnect,
  suggestionsMachine,
  suggestionsMessages,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    suggestions: SuggestionsMessages
  }
}

/** What every part's `render` receives. */
export interface SuggestionsRenderState {
  readonly state: SuggestionsState
  readonly count: number
}

type Api = ReturnType<typeof suggestionsConnect>

interface Entry {
  readonly el: Element
  readonly key: string
}

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: SuggestionsRenderState
  readonly register: (id: string, entry: Entry) => () => void
  readonly indexOf: (id: string) => number
  readonly press: (details: {
    key: string
    value: string
    index: number
    itemDisabled: boolean
    focusWasInside: boolean
  }) => void
  readonly contains: (el: Element | null) => boolean
}
const SuggestionsContext = createContext<Ctx>()
function useSuggestions(part: string): Ctx {
  const ctx = useContext(SuggestionsContext)
  if (!ctx) throw new Error(`Suggestions.${part} must be inside Suggestions.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<SuggestionsRenderState> | undefined
  readonly children?: JSX.Element | ((state: SuggestionsRenderState) => JSX.Element)
}

// `onSelect` is the suggestion picked, not the DOM `select` event.
export type SuggestionsRootProps = PartProps<
  Omit<JSX.HTMLAttributes<HTMLDivElement>, "onSelect">
> & {
  /** A press: put the value in the prompt, or send it. The component does neither. */
  readonly onSelect?: ((details: SuggestionsSelectDetails) => void) | undefined
  /** The items stay, disabled and focusable; the group is busy. */
  readonly loading?: boolean | undefined
  /** No press does anything. */
  readonly disabled?: boolean | undefined
  /** Announce a new set ("3 suggestions"); never on mount. Default "off". */
  readonly announce?: "off" | "polite" | undefined
  /** Where the focus goes after a press that began inside (the prompt). */
  readonly focusTarget?: (() => { focus(): void } | null) | undefined
  readonly messages?: MessageOverrides<SuggestionsMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}

/** DOM order: the items' indexes and the reported keys follow the rendered order. */
const byDocument = (a: Entry, b: Entry) =>
  a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1

function Root(props: SuggestionsRootProps) {
  const [own, rest] = splitProps(props, [
    "onSelect",
    "loading",
    "disabled",
    "announce",
    "focusTarget",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("suggestions", suggestionsMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const { view, send } = useMachine(
    suggestionsMachine,
    () => ({
      loading: own.loading === true,
      disabled: own.disabled === true,
      announce: own.announce,
      onSelect: (d: SuggestionsSelectDetails) => own.onSelect?.(d),
      focusTarget: () => own.focusTarget?.() ?? null,
      messages: messages(),
      id: instance(),
      lang: locale().locale,
    }),
    env,
  )
  const [entries, setEntries] = createSignal<ReadonlyMap<string, Entry>>(new Map())
  const ordered = createMemo(() =>
    [...entries().entries()].sort(([, a], [, b]) => byDocument(a, b)),
  )
  let rootEl: HTMLElement | undefined
  const api = createMemo(() =>
    suggestionsConnect(
      {
        instance: instance(),
        state: view().state as SuggestionsState,
        count: ordered().length,
        messages: messages(),
        named: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
      },
      env,
    ),
  )
  afterMount(() => {
    // The rendered keys, in order, once per change: items register one by one (on mount, and
    // when a new set replaces the old one), so the report waits for the end of that microtask.
    // The first report is then the whole first set, never announced.
    let pending = false
    createEffect(() => {
      ordered()
      if (pending) return
      pending = true
      queueMicrotask(() => {
        pending = false
        const keys = untrack(ordered).map(([, e]) => e.key)
        send({ type: "ITEMS", keys })
      })
    })
  })
  const state = reactive<SuggestionsRenderState>(() => ({
    state: view().state as SuggestionsState,
    count: ordered().length,
  }))
  const ctx: Ctx = {
    api,
    state,
    register: (id, entry) => {
      setEntries((m) => new Map(m).set(id, entry))
      return () =>
        setEntries((m) => {
          const next = new Map(m)
          next.delete(id)
          return next
        })
    },
    indexOf: (id) => ordered().findIndex(([k]) => k === id),
    press: (d) => send({ type: "PRESS", ...d }),
    contains: (el) => el !== null && rootEl?.contains(el) === true,
  }
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        ref: (el: HTMLElement) => {
          rootEl = el
        },
        ...(rest.id === undefined ? {} : { id: rest.id }),
      },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <SuggestionsContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </SuggestionsContext.Provider>
  )
}

export type SuggestionsItemProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>> & {
  /** What `onSelect` receives; default: the Label's text (else the item's text). */
  readonly value?: string | undefined
  /** This suggestion does nothing (stays focusable). */
  readonly disabled?: boolean | undefined
}

function Item(props: SuggestionsItemProps) {
  const [local, rest] = splitProps(props, ["value", "disabled", "render", "children"])
  const ctx = useSuggestions("Item")
  const id = createUniqueId()
  const key = () => local.value ?? id
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  const [measured, setMeasured] = createSignal<string | undefined>()
  afterMount(() => {
    const node = el()
    if (local.render && node) setMeasured(node.tagName.toLowerCase())
    createEffect(() => {
      const n = el()
      if (n) onCleanup(ctx.register(id, { el: n, key: key() }))
    })
  })
  const tag = () => (local.render ? (measured() ?? "button") : "button")
  const native = () => tag() === "button" || tag() === "input"
  // Where the focus was when the press began (a pointer press moves it onto the item).
  let wasInside = false
  const begin = () => {
    wasInside = ctx.contains(el()?.ownerDocument.activeElement ?? null)
  }
  const merged = createMemo(() => {
    const api = normalizeProps(
      ctx.api().item({
        key: key(),
        index: ctx.indexOf(id),
        disabled: local.disabled === true,
        tag: tag(),
        focused: focused(),
        modality: modality(),
      }),
    )
    return mergeProps(
      {
        ...joinHandlers(api, {
          onPointerDown: begin,
          onClick: (e: MouseEvent) => {
            // A click without a pointerdown (a keyboard press, an assistive technology): the
            // focus is where it is now.
            if (e.detail === 0) begin()
            const node = e.currentTarget as HTMLElement
            const label = node.querySelector('[data-scope="suggestions"][data-part="label"]')
            ctx.press({
              key: key(),
              value: local.value ?? (label ?? node).textContent?.trim() ?? "",
              index: ctx.indexOf(id),
              itemDisabled: local.disabled === true,
              focusWasInside: wasInside,
            })
            wasInside = false
          },
          // A substituted non-button element: Enter and Space click it, as a button would.
          onKeyDown: (e: KeyboardEvent) => {
            if (native() || e.repeat) return
            if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
            if (e.key === " ") e.preventDefault()
          },
          onKeyUp: (e: KeyboardEvent) => {
            if (!native() && e.key === " ") (e.currentTarget as HTMLElement).click()
          },
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        ref: setEl,
      },
      rest,
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type SuggestionsLabelProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function Label(props: SuggestionsLabelProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSuggestions("Label")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().label()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type SuggestionsDescriptionProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function Description(props: SuggestionsDescriptionProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSuggestions("Description")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().description()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The parts, by name: `suggestions.parts.ts` re-exports them as the `Suggestions` namespace. */
export { Description, Item, Label, Root }
