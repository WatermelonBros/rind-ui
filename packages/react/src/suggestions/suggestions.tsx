"use client"

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
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    suggestions: SuggestionsMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

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
  readonly api: Api
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
const SuggestionsContext = createContext<Ctx | null>(null)
function useSuggestions(part: string): Ctx {
  const ctx = useContext(SuggestionsContext)
  if (!ctx) throw new Error(`Suggestions.${part} must be inside Suggestions.Root`)
  return ctx
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<SuggestionsRenderState>
}

// `onSelect` is the suggestion picked, not the DOM `select` event.
export type SuggestionsRootProps = Omit<PartProps<"div">, "onSelect"> & {
  /** A press: put the value in the prompt, or send it. The component does neither. */
  readonly onSelect?: (details: SuggestionsSelectDetails) => void
  /** The items stay, disabled and focusable; the group is busy. */
  readonly loading?: boolean
  /** No press does anything. */
  readonly disabled?: boolean
  /** Announce a new set ("3 suggestions"); never on mount. Default "off". */
  readonly announce?: "off" | "polite"
  /** Where the focus goes after a press that began inside (the prompt). */
  readonly focusTarget?: () => { focus(): void } | null
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<SuggestionsMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
}

/** DOM order: the items' indexes and the reported keys follow the rendered order. */
const byDocument = (a: Entry, b: Entry) =>
  a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1

function Root({
  onSelect,
  loading = false,
  disabled = false,
  announce,
  focusTarget,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: SuggestionsRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("suggestions", suggestionsMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const { view, send } = useMachine(
    suggestionsMachine,
    {
      loading,
      disabled,
      announce,
      onSelect: (d: SuggestionsSelectDetails) => onSelect?.(d),
      focusTarget: () => focusTarget?.() ?? null,
      messages,
      id: instance,
      lang: locale,
    },
    env,
  )
  const [entries, setEntries] = useState<ReadonlyMap<string, Entry>>(() => new Map())
  const ordered = [...entries.entries()].sort(([, a], [, b]) => byDocument(a, b))
  const rootEl = useRef<HTMLElement | null>(null)
  const api = suggestionsConnect(
    {
      instance,
      state: view.state as SuggestionsState,
      count: ordered.length,
      messages,
      named: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
    },
    env,
  )
  // The rendered keys, in order, once per change: items register one by one (on mount, and
  // when a new set replaces the old one), so the report waits for the end of that microtask.
  // The first report is then the whole first set, never announced.
  const keys = ordered.map(([, e]) => e.key)
  const latestKeys = useRef(keys)
  latestKeys.current = keys
  const signature = keys.join("\u0000")
  const pending = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: reports when the key list changes
  useEffect(() => {
    if (pending.current) return
    pending.current = true
    queueMicrotask(() => {
      pending.current = false
      send({ type: "ITEMS", keys: latestKeys.current })
    })
  }, [signature, send])
  const state: SuggestionsRenderState = {
    state: view.state as SuggestionsState,
    count: ordered.length,
  }
  const ctx: Ctx = {
    api,
    state,
    register: (itemId, entry) => {
      setEntries((m) => new Map(m).set(itemId, entry))
      return () =>
        setEntries((m) => {
          const next = new Map(m)
          next.delete(itemId)
          return next
        })
    },
    indexOf: (itemId) => ordered.findIndex(([k]) => k === itemId),
    press: (d) => send({ type: "PRESS", ...d }),
    contains: (el) => el !== null && rootEl.current?.contains(el) === true,
  }
  const props = mergeProps(
    {
      ...normalizeProps(api.root()),
      ref: composeRefs(rootEl, ref),
      ...(id === undefined ? {} : { id }),
    },
    rest,
  )
  return (
    <SuggestionsContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </SuggestionsContext>
  )
}

export type SuggestionsItemProps = PartProps<"button"> & {
  /** What `onSelect` receives; default: the Label's text (else the item's text). */
  readonly value?: string
  /** This suggestion does nothing (stays focusable). */
  readonly disabled?: boolean
}

function Item({ value, disabled = false, render, ref, ...rest }: SuggestionsItemProps) {
  const ctx = useSuggestions("Item")
  const id = useId()
  const key = value ?? id
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const register = ctx.register
  // Not on `register`: it is a fresh closure every render (it would re-register forever).
  useIsoLayoutEffect(() => {
    const node = el.current
    if (node) return register(id, { el: node, key })
  }, [id, key])
  const native = tag === "button" || tag === "input"
  // Where the focus was when the press began (a pointer press moves it onto the item).
  const wasInside = useRef(false)
  const begin = () => {
    wasInside.current = ctx.contains(el.current?.ownerDocument.activeElement ?? null)
  }
  const index = ctx.indexOf(id)
  const api = normalizeProps(ctx.api.item({ key, index, disabled, tag, focused, modality }))
  const props = mergeProps(
    {
      ...joinHandlers(api, {
        onPointerDown: begin,
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          // A click without a pointerdown (a keyboard press, an assistive technology): the
          // focus is where it is now.
          if (e.detail === 0) begin()
          const node = e.currentTarget
          const label = node.querySelector('[data-scope="suggestions"][data-part="label"]')
          ctx.press({
            key,
            value: value ?? (label ?? node).textContent?.trim() ?? "",
            index: ctx.indexOf(id),
            itemDisabled: disabled,
            focusWasInside: wasInside.current,
          })
          wasInside.current = false
        },
        // A substituted non-button element: Enter and Space click it, as a button would.
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          if (native || e.repeat) return
          if (e.key === "Enter") e.currentTarget.click()
          if (e.key === " ") e.preventDefault()
        },
        onKeyUp: (e: KeyboardEvent<HTMLElement>) => {
          if (!native && e.key === " ") e.currentTarget.click()
        },
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", props, render, ctx.state)
}

export type SuggestionsLabelProps = PartProps<"span">

function Label({ render, ...rest }: SuggestionsLabelProps) {
  const ctx = useSuggestions("Label")
  return renderPart("span", mergeProps(normalizeProps(ctx.api.label()), rest), render, ctx.state)
}

export type SuggestionsDescriptionProps = PartProps<"span">

function Description({ render, ...rest }: SuggestionsDescriptionProps) {
  const ctx = useSuggestions("Description")
  return renderPart(
    "span",
    mergeProps(normalizeProps(ctx.api.description()), rest),
    render,
    ctx.state,
  )
}

/** The parts, by name: `suggestions.parts.ts` re-exports them as the `Suggestions` namespace. */
export { Description, Item, Label, Root }
