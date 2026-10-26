// Suggestions (add-suggestions): a named group of buttons. The Root reports the rendered items'
// keys (ITEMS) and each press (PRESS); the machine calls onSelect and moves the focus.
import {
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
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
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"

/** The group's state, for the template (`#s="rindSuggestionsRoot"`, `s.state()`). */
export interface SuggestionsRenderState {
  readonly state: SuggestionsState
  readonly count: number
}

interface Entry {
  readonly el: Element
  readonly key: string
}

const SUGGESTIONS = new InjectionToken<SuggestionsRoot>("rind-ui.suggestions")

function injectSuggestions(part: string): SuggestionsRoot {
  const root = inject(SUGGESTIONS, { optional: true })
  if (!root) throw new Error(`rindSuggestions${part} must be inside rindSuggestionsRoot`)
  return root
}

/** DOM order: the items' indexes and the reported keys follow the rendered order. */
const byDocument = (a: Entry, b: Entry) =>
  a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1

let nextItem = 0

/**
 * Prompt suggestions: `<div rindSuggestionsRoot (pick)="use($event.value)">` holding
 * `<button rindSuggestionsItem>` items, each with a Label and an optional Description.
 */
@Directive({
  selector: "[rindSuggestionsRoot]",
  exportAs: "rindSuggestionsRoot",
  providers: [{ provide: SUGGESTIONS, useExisting: forwardRef(() => SuggestionsRoot) }],
})
export class SuggestionsRoot {
  /** The items stay, disabled and focusable; the group is busy. */
  readonly loading = input(false, { transform: booleanAttribute })
  /** No press does anything. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Announce a new set ("3 suggestions"); never on mount. Default "off". */
  readonly announce = input<"off" | "polite">()
  /** Where the focus goes after a press that began inside (the prompt). */
  readonly focusTarget = input<() => { focus(): void } | null>()
  readonly messages = input<MessageOverrides<SuggestionsMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  readonly id = input<string>()
  /**
   * A press (`onSelect`): put the value in the prompt, or send it. The component does neither.
   * Not `select`: a `(select)` listener also hears the native select event bubbling up.
   */
  readonly pick = output<SuggestionsSelectDetails>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof suggestionsConnect>>
  /** @internal */
  readonly send: (event: SuggestionsEvent) => void
  /** @internal */
  readonly el: HTMLElement = inject(ElementRef).nativeElement
  readonly state: Signal<SuggestionsRenderState>
  private readonly entries = signal<ReadonlyMap<string, Entry>>(new Map())
  /** @internal */
  readonly ordered = computed(() =>
    [...this.entries().entries()].sort(([, a], [, b]) => byDocument(a, b)),
  )

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment(announcerCapability)
    const messages = injectMessages("suggestions", suggestionsMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    const { view, send } = injectMachine(
      suggestionsMachine,
      () => ({
        loading: this.loading(),
        disabled: this.disabled(),
        announce: this.announce(),
        onSelect: (d: SuggestionsSelectDetails) => this.pick.emit(d),
        focusTarget: () => this.focusTarget()?.() ?? null,
        messages: messages(),
        id: instance(),
        lang: locale().locale,
      }),
      env,
    )
    this.send = send
    const read = (name: string) => inject(new HostAttributeToken(name), { optional: true })
    const named = read("aria-label") !== null || read("aria-labelledby") !== null
    this.api = computed(() =>
      suggestionsConnect(
        {
          instance: instance(),
          state: view().state,
          count: this.ordered().length,
          messages: messages(),
          named,
        },
        env,
      ),
    )
    this.state = computed(() => ({ state: view().state, count: this.ordered().length }))
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      { owns: ["announce", "disabled", "focustarget", "id", "loading", "locale", "messages"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // The rendered keys, in order, once per change: items register one by one (on the first
    // render, and when a new set replaces the old one), so the report waits for the end of that
    // microtask. The first report is then the whole first set, never announced.
    let pending = false
    effect(() => {
      this.ordered()
      if (pending) return
      pending = true
      queueMicrotask(() => {
        pending = false
        send({ type: "ITEMS", keys: untracked(this.ordered).map(([, e]) => e.key) })
      })
    })
  }

  /** @internal */
  register(id: string, entry: Entry): () => void {
    this.entries.update((m) => new Map(m).set(id, entry))
    return () =>
      this.entries.update((m) => {
        const next = new Map(m)
        next.delete(id)
        return next
      })
  }

  /** @internal */
  indexOf(id: string): number {
    return this.ordered().findIndex(([k]) => k === id)
  }
}

/** One suggestion: `<button rindSuggestionsItem>`; its Label's text is the value by default. */
@Directive({ selector: "[rindSuggestionsItem]", exportAs: "rindSuggestionsItem" })
export class SuggestionsItem {
  /** What `pick` receives; default: the Label's text (else the item's text). */
  readonly value = input<string>()
  /** This suggestion does nothing (stays focusable). */
  readonly disabled = input(false, { transform: booleanAttribute })
  constructor() {
    const root = injectSuggestions("Item")
    const el: HTMLElement = inject(ElementRef).nativeElement
    const id = `item-${++nextItem}`
    const key = () => this.value() ?? id
    const tag = el.tagName.toLowerCase()
    const native = tag === "button" || tag === "input"
    const env = injectEnvironment()
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    // Where the focus was when the press began (a pointer press moves it onto the item).
    let wasInside = false
    const begin = () => {
      const active = el.ownerDocument.activeElement
      wasInside = active !== null && root.el.contains(active)
    }
    bindProps(
      () =>
        joinHandlers(
          root.api().item({
            key: key(),
            index: root.indexOf(id),
            disabled: this.disabled(),
            tag,
            focused: focused(),
            modality: modality(),
          }),
          {
            onPointerDown: begin,
            onClick: (e: MouseEvent) => {
              // A click without a pointerdown (keyboard, assistive technology): focus is where
              // it is now.
              if (e.detail === 0) begin()
              const label = el.querySelector('[data-scope="suggestions"][data-part="label"]')
              root.send({
                type: "PRESS",
                key: untracked(key),
                value: untracked(this.value) ?? (label ?? el).textContent?.trim() ?? "",
                index: untracked(() => root.indexOf(id)),
                itemDisabled: untracked(this.disabled),
                focusWasInside: wasInside,
              })
              wasInside = false
            },
            // A non-button element: Enter and Space click it, as a button would.
            onKeyDown: (e: KeyboardEvent) => {
              if (native || e.repeat) return
              if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
              if (e.key === " ") e.preventDefault()
            },
            onKeyUp: (e: KeyboardEvent) => {
              if (!native && e.key === " ") (e.currentTarget as HTMLElement).click()
            },
            onFocusIn: () => focused.set(true),
            onFocusOut: () => focused.set(false),
          },
        ),
      { owns: ["disabled", "value"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // Tracks the modality from the first render, so the first keyboard focus is already visible.
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    effect((onCleanup) => {
      const off = root.register(id, { el, key: key() })
      onCleanup(off)
    })
  }
}

/** The main text. */
@Directive({ selector: "[rindSuggestionsLabel]", exportAs: "rindSuggestionsLabel" })
export class SuggestionsLabel {
  constructor() {
    const root = injectSuggestions("Label")
    bindProps(() => root.api().label())
  }
}

/** Secondary text, part of the Item's name. */
@Directive({ selector: "[rindSuggestionsDescription]", exportAs: "rindSuggestionsDescription" })
export class SuggestionsDescription {
  constructor() {
    const root = injectSuggestions("Description")
    bindProps(() => root.api().description())
  }
}

/** The Suggestions' parts, for a standalone component's `imports`. */
export const Suggestions = [
  SuggestionsRoot,
  SuggestionsItem,
  SuggestionsLabel,
  SuggestionsDescription,
] as const
