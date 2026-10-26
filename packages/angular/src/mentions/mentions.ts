// Mentions (add-mentions): a textarea that opens a listbox at a trigger character ("@", "#",
// "/"). The machine reconciles every input from the text before and after it; here the textarea
// reports input, caret moves and composition, the list parts are the listbox parts under scope
// "mentions" (as Combobox), and the Highlighter mirrors the text with the mentions painted.
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
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
import { bindProps, joinHandlers } from "../bind-props"
import { injectCollectionItems } from "../collection-items"
import { ComboboxPopup, ComboboxPositioner, POPUP_HOST, type PopupHost } from "../combobox/combobox"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import {
  groupsOf,
  LISTBOX_HOST,
  ListboxEmpty,
  type ListboxGroup,
  type ListboxHost,
  ListboxItem,
  ListboxItemText,
  ListboxList,
  ListboxSection,
} from "../listbox/parts"
import { injectEnvironment, injectMessages, withCapabilities } from "../provider"
import { RindProps } from "../rind-props"

const EMPTY = createListCollection({ items: [] as string[], getKey: (s) => s, getText: (s) => s })

/** The mentions' state, for the template (`#m="rindMentionsRoot"`, `m.state()`). */
export interface MentionsRenderState {
  readonly open: boolean
  /** The trigger id at the caret ("@", or a trigger's own id), null when closed. */
  readonly trigger: string | null
  /** The text typed after the trigger. */
  readonly query: string
}

type Api = ReturnType<typeof mentionsConnect>
/** One run of the mirrored text: plain or a mention. */
type MentionSegment = Api["segments"][number]

function injectMentions(part: string): MentionsRoot {
  const root = inject(MentionsRoot, { optional: true })
  if (!root) throw new Error(`rindMentions${part} must be inside rindMentionsRoot`)
  return root
}

/**
 * A textarea with mentions: `<div rindMentionsRoot [triggers]="[{ char: '@' }]">` with a
 * Highlighter, the Textarea, a Description and a Positioner holding the Popup's List of Items.
 */
@Directive({
  selector: "[rindMentionsRoot]",
  exportAs: "rindMentionsRoot",
  providers: [
    { provide: POPUP_HOST, useExisting: forwardRef(() => MentionsRoot) },
    { provide: LISTBOX_HOST, useFactory: () => inject(forwardRef(() => MentionsRoot)).list },
  ],
})
export class MentionsRoot implements PopupHost {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id = input<string>()
  /** Controlled text (`[(value)]`). */
  readonly value = input<string>()
  /** Uncontrolled text. Default "". */
  readonly defaultValue = input<string>()
  /** Controlled mention ranges (`[(mentions)]`). */
  readonly mentions = input<readonly MentionRange[]>()
  /** Uncontrolled mention ranges. */
  readonly defaultMentions = input<readonly MentionRange[]>()
  /** `{ char, id?, behavior?: "insert" | "action", startOfInput?, allowSpaces?, appendSpace? }`. */
  readonly triggers = input.required<readonly MentionTrigger[]>()
  /** The options for the current query (default: the Item parts, filtered by the query). */
  readonly items = input<Collection<unknown>>()
  /** The matcher for the Item parts; `null` lists them unfiltered. */
  readonly filter = input<ComboboxFilter | null>()
  /** The inserted label (default: the trigger char and the text). */
  readonly formatLabel =
    input<(item: { readonly key: string; readonly text: string }, trigger: string) => string>()
  /** Tab inserts the highlighted option. Default true. */
  readonly selectOnTab = input(true, { transform: booleanAttribute })
  /** Results are loading. */
  readonly loading = input<LoadingStatus>()
  /** No editing; the list never opens. */
  readonly readOnly = input(false, { transform: booleanAttribute })
  /** Not editable or submitted. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** The list's placement at the trigger (default: below, flipping). */
  readonly positioning = input<PositioningProps>()
  /** The list stays mounted (hidden) while closed. */
  readonly keepMountedInput = input(false, { alias: "keepMounted", transform: booleanAttribute })
  readonly messages = input<MessageOverrides<MentionsMessages>>()
  /** Every change of the text (`[(value)]`). */
  readonly valueChange = output<string>()
  readonly valueChangeDetails = output<{ value: string; details: ChangeDetails<MentionsEvent> }>()
  /** Mentions added, moved or removed (`[(mentions)]`). */
  readonly mentionsChange = output<readonly MentionRange[]>()
  readonly mentionsChangeDetails = output<{
    value: readonly MentionRange[]
    details: ChangeDetails<MentionsEvent>
  }>()
  /** The trigger and query at the caret; null when it closes. */
  readonly queryChange = output<MentionsQuery | null>()
  /** An "action" trigger's choice. */
  readonly pick = output<MentionsSelectDetails>()

  // PopupHost
  readonly present = signal(false)
  readonly topLayer = signal(false)
  readonly inlineMode = false
  readonly popupName = "Mentions"
  readonly popupScope = "mentions"
  readonly keepMounted = () => this.keepMountedInput()
  readonly isOpen: () => boolean

  /** @internal */
  readonly api: Signal<Api>
  /** @internal */
  readonly list: ListboxHost
  /** @internal */
  readonly send: (event: MentionsEvent) => void
  /** @internal */
  readonly highlighted: () => CollectionKey | null
  /** @internal */
  textareaEl: HTMLTextAreaElement | null = null
  /** @internal */
  highlighterEl: HTMLElement | null = null
  /** The state, for the template. */
  readonly state: Signal<MentionsRenderState>
  /** The listed options' sections and items in render order, for an `@for` of Items. */
  readonly groups: Signal<readonly ListboxGroup[]>

  constructor() {
    const base = injectEnvironment(announcerCapability, layoutCapability)
    const messages = injectMessages("mentions", mentionsMessages, () => this.messages())
    const instance = injectRootId(() => this.id())
    // The caret the machine asked for: placed once the value it wrote is rendered.
    let caret: number | null = null
    const placeCaret = () => {
      const el = this.textareaEl
      const c = caret
      if (!el || c === null) return
      // Not before the value it belongs to is rendered (a render follows and places it).
      if (el.value !== (untracked(view).values.value ?? "")) return
      caret = null
      el.setSelectionRange(c, c)
    }
    const env = withCapabilities(base, {
      position: domPositioning(base),
      setCaret: (c: number) => {
        caret = c
        queueMicrotask(placeCaret)
      },
    })
    const { collection: registered, registry } = injectCollectionItems()
    // The query, mirrored from the service (the props read it, and the view reads the props).
    const query = signal<MentionsQuery | null>(null)
    const results = computed(() => {
      const items = this.items()
      if (items) return items
      return patternResults(
        registered() ?? EMPTY,
        query()?.query ?? "",
        this.filter(),
        base.locale.locale(),
      )
    })
    const ids = computed(() => mentionsIds(instance()))
    const machineProps = () => {
      const format = this.formatLabel()
      return {
        root: instance(),
        ids: ids(),
        strategy: "active-descendant" as const,
        collection: results(),
        loading: this.loading(),
        positioning: this.positioning(),
        messages: messages(),
        triggers: this.triggers(),
        value: this.value(),
        defaultValue: this.defaultValue(),
        onValueChange: (value: string, details: ChangeDetails<MentionsEvent>) => {
          this.valueChange.emit(value)
          this.valueChangeDetails.emit({ value, details })
        },
        mentions: this.mentions(),
        defaultMentions: this.defaultMentions(),
        onMentionsChange: (
          value: readonly MentionRange[],
          details: ChangeDetails<MentionsEvent>,
        ) => {
          this.mentionsChange.emit(value)
          this.mentionsChangeDetails.emit({ value, details })
        },
        onQueryChange: (q: MentionsQuery | null) => this.queryChange.emit(q),
        onSelect: (d: MentionsSelectDetails) => this.pick.emit(d),
        ...(format ? { formatLabel: format } : {}),
        selectOnTab: this.selectOnTab(),
        readOnly: this.readOnly(),
        disabled: this.disabled(),
        anchor: () => {
          const el = this.textareaEl
          const m = service().view().context.match
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
      }
    }
    // Sound: the props built here are the mentions machine's (React's own shape).
    const { view, service, send } = injectMachine(mentionsMachine, machineProps as never, env)
    this.send = send
    this.highlighted = () => service().view().context.highlightedKey
    const mirror = () => {
      const m = service().view().context.match
      const q = untracked(query)
      if (m?.trigger !== q?.trigger || m?.query !== q?.query) query.set(m ?? null)
    }
    const open = () => view().matches("open")
    this.isOpen = open
    const match = () => view().context.match
    const mounted = signal<{
      label: boolean
      empty: boolean
      descriptions: ReadonlySet<CollectionKey>
    }>({ label: false, empty: false, descriptions: new Set() })
    const modality = injectModality(base.modality, () => view().context.focused)
    const exposure = () => ({
      open: open(),
      results: results(),
      query: match()?.query ?? "",
      loading: this.loading(),
    })
    this.api = computed(() => {
      const v = view()
      const m = mounted()
      return mentionsConnect(
        {
          instance: instance(),
          open: open(),
          empty: isEmptyState(exposure()),
          results: results(),
          context: v.context,
          disabled: this.disabled(),
          loading: this.loading(),
          modality: modality(),
          dir: base.locale.dir(),
          mounted: {
            label: m.label,
            empty: m.empty,
            description: (key) => m.descriptions.has(key),
          },
          topLayer: this.topLayer(),
          blur: () => send({ type: "INPUT.BLUR" }),
          value: v.values.value ?? "",
          mentions: v.values.mentions ?? [],
          match: v.context.match,
          triggers: this.triggers().map((t) => t.char),
          readOnly: this.readOnly(),
          composing: v.context.composing,
          messages: messages(),
          send,
        },
        env,
      )
    })
    this.state = computed(() => ({
      open: open(),
      trigger: match()?.trigger ?? null,
      query: match()?.query ?? "",
    }))
    this.groups = computed(() => groupsOf(results()))
    this.list = {
      name: "Mentions",
      // Sound: the mentions api has every listbox part the shared parts call.
      parts: () =>
        ({ ...this.api(), isEmpty: isEmptyState(exposure()) }) as unknown as ReturnType<
          ListboxHost["parts"]
        >,
      collection: () => results(),
      registry: () => (this.items() ? null : registry),
      listed: (key) => results().has(key),
      mount: (part, on) => {
        const m = untracked(mounted)
        if (m[part] !== on) mounted.set({ ...m, [part]: on })
      },
      mountDescription: (key, on) => {
        const m = untracked(mounted)
        if (m.descriptions.has(key) === on) return
        const next = new Set(m.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        mounted.set({ ...m, descriptions: next })
      },
      requestLoadMore: () => {},
      instance: () => instance(),
    }
    bindProps(() => this.api().root(), {
      owns: [
        "defaultmentions",
        "defaultvalue",
        "disabled",
        "filter",
        "formatlabel",
        "items",
        "keepmounted",
        "loading",
        "mentions",
        "messages",
        "positioning",
        "readonly",
        "selectontab",
        "triggers",
        "value",
      ],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterEveryRender(placeCaret)
    afterNextRender(() => {
      mirror()
      destroy.onDestroy(service().subscribe(mirror))
      // Known after render: the server render and hydration never carry `popover`.
      this.topLayer.set(
        typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype,
      )
    })
  }
}

/** The text field: a textbox, a combobox while its list is open: `<textarea rindMentionsTextarea>`. */
@Directive({ selector: "textarea[rindMentionsTextarea]", exportAs: "rindMentionsTextarea" })
export class MentionsTextarea {
  constructor() {
    const root = injectMentions("Textarea")
    const el: HTMLTextAreaElement = inject(ElementRef).nativeElement
    root.textareaEl = el
    const send = (e: MentionsEvent) => root.send(e)
    const at = () => el.selectionStart ?? el.value.length
    bindProps(() =>
      joinHandlers(root.api().textarea(), {
        onInput: (e: InputEvent) =>
          send({ type: "INPUT", value: el.value, caret: at(), composing: e.isComposing }),
        onSelect: () => send({ type: "CARET", caret: at() }),
        onClick: () => send({ type: "CARET", caret: at() }),
        onKeyUp: (e: KeyboardEvent) => {
          // Only caret keys: an input already reported its caret.
          if (/^(Arrow|Home|End|Page)/.test(e.key) && !untracked(root.isOpen)) {
            send({ type: "CARET", caret: at() })
          }
        },
        onCompositionStart: () => send({ type: "COMPOSITION.START" }),
        onCompositionEnd: () => send({ type: "COMPOSITION.END", value: el.value, caret: at() }),
        onKeyDown: (e: KeyboardEvent) => {
          // Closed: the textarea's own keys (no interception).
          if (!untracked(root.isOpen)) return
          const composing = e.isComposing || e.keyCode === 229
          if (composing) return
          const highlighted = root.highlighted()
          switch (e.key) {
            case "ArrowDown":
            case "ArrowUp":
              e.preventDefault()
              send({
                type: "ARROW",
                key: e.key === "ArrowDown" ? "NEXT" : "PREV",
                alt: e.altKey,
                composing,
              })
              return
            case "Enter":
              if (highlighted === null) return
              e.preventDefault()
              send({ type: "ENTER", composing })
              return
            case "Tab":
              // Tab inserts only a highlighted option; otherwise focus moves on.
              if (!untracked(root.selectOnTab) || highlighted === null) return
              e.preventDefault()
              send({ type: "TAB", composing })
              return
            case "Escape":
              e.preventDefault()
              // The list closes; a surrounding dialog stays open.
              e.stopPropagation()
              send({ type: "ESCAPE", composing })
              return
          }
        },
        onScroll: () => {
          const h = root.highlighterEl
          if (h) {
            h.scrollTop = el.scrollTop
            h.scrollLeft = el.scrollLeft
          }
        },
        onFocus: () => send({ type: "INPUT.FOCUS" }),
        onBlur: () => send({ type: "INPUT.BLUR" }),
      }),
    )
  }
}

/** Names the triggers ("Type @ to insert a mention"); its content replaces the default text. */
@Component({
  selector: "[rindMentionsDescription]",
  exportAs: "rindMentionsDescription",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class MentionsDescription {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectMentions("Description")
    this.text = computed(() => root.api().description)
    bindProps(() => root.api().descriptionPart())
  }
}

/**
 * The text mirrored under the textarea, the mentions painted (hidden from assistive technology):
 * `<div rindMentionsHighlighter>`.
 */
@Component({
  selector: "[rindMentionsHighlighter]",
  exportAs: "rindMentionsHighlighter",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `@for (s of segments(); track $index) {@if (s.kind === "text") {<span>{{ s.text }}</span>} @else {<mark [rindProps]="mark(s)">{{ s.text }}</mark>}}`,
})
export class MentionsHighlighter {
  /** @internal */
  protected readonly segments: Signal<readonly MentionSegment[]>
  /** @internal */
  protected readonly mark: (s: MentionSegment) => ReturnType<Api["mention"]>
  constructor() {
    const root = injectMentions("Highlighter")
    root.highlighterEl = inject(ElementRef).nativeElement
    this.segments = computed(() => root.api().segments)
    this.mark = (s) => (s.kind === "mention" ? root.api().mention(s.mention) : {})
    bindProps(() => root.api().highlighter())
  }
}

/** Loading content: a sibling of the List, shown while loading. */
@Directive({ selector: "[rindMentionsLoading]", exportAs: "rindMentionsLoading" })
export class MentionsLoading {
  constructor() {
    const root = injectMentions("Loading")
    bindProps(() => root.api().loading())
  }
}

/**
 * The Mentions' parts: the Root, Textarea, Description, Highlighter and Loading, plus the shared
 * popup and listbox parts (`rindMentionsPositioner`, `rindMentionsPopup`, `rindMentionsList`,
 * `rindMentionsItem`, `rindMentionsItemText`, `rindMentionsGroup`, `rindMentionsEmpty`).
 */
export const Mentions = [
  MentionsRoot,
  MentionsTextarea,
  MentionsDescription,
  MentionsHighlighter,
  MentionsLoading,
  ComboboxPositioner,
  ComboboxPopup,
  ListboxList,
  ListboxItem,
  ListboxItemText,
  ListboxSection,
  ListboxEmpty,
] as const
