// Tags Input (tags-input spec): Root owns the machine and the form inputs; the chips are
// rendered from the value. With suggestions, Root derives the listed ones from the draft
// (patternResults, without the chosen options) and the list parts are the listbox parts
// under scope "tags-input", the popup parts the Combobox's. Wiring only.
import {
  ApplicationRef,
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  type ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  announcerCapability,
  type Chip as ChipData,
  type Collection,
  type CollectionKey,
  type ComboboxFilter,
  createListCollection,
  type Delimiters,
  domPositioning,
  focusSafely,
  hiddenFormInput,
  isEmptyState,
  isExposed,
  isStale,
  type LoadingStatus,
  layoutCapability,
  mergeFieldProps,
  type PositioningProps,
  patternResults,
  type TagRefusal,
  type TagsInputMessages,
  tagChips,
  tagSuggestions,
  tagsInputConnect,
  tagsInputIds,
  tagsInputMachine,
  tagsInputMessages,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { ComboboxPopup, ComboboxPositioner, POPUP_HOST, type PopupHost } from "../combobox/combobox"
import { injectFieldControl } from "../field/context"
import { injectFieldsetDisabled } from "../fieldset/context"
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
  ListboxLabel,
  ListboxList,
  ListboxSection,
  ListboxSeparator,
} from "../listbox/parts"
import { injectEnvironment, withCapabilities } from "../provider"
import { RindProps } from "../rind-props"

export interface TagsInputChangeDetails {
  readonly reason: string
}

/** What a `valueChangeDetails` output emits. */
export interface TagsInputValueEvent {
  readonly value: readonly string[]
  readonly details: TagsInputChangeDetails
}

/** What an `inputValueChangeDetails` output emits. */
export interface TagsInputInputValueEvent {
  readonly value: string
  readonly details: TagsInputChangeDetails
}

/** One suggestion of a data-driven Tags Input: choosing it creates the tag `key`. */
export interface TagsInputItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly section?: { readonly key: string; readonly label: string }
}

const fromData = (items: readonly TagsInputItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const NO_ITEMS = fromData([])

/** The machine event that changed the value, as the public reason. */
const reasonOf = (type: string, delimiter: boolean) =>
  ({
    ENTER: "enter",
    PASTE: "paste",
    "FOCUS.LEAVE": "blur",
    "EDIT.COMMIT": "edit",
    "EDIT.BLUR": "edit",
    "CHIP.REMOVE": "chip-remove",
    BACKSPACE_EMPTY: "backspace",
    "CLEAR.PRESS": "clear",
    CLEAR: "clear",
    "FORM.RESET": "reset",
    "INPUT.CHANGE": delimiter ? "delimiter" : "input-change",
    "COMPOSITION.END": delimiter ? "delimiter" : "input-change",
    "CHIP.TYPE": "input-change",
    ADD: "add",
    "ITEM.CHOOSE": "item-press",
  })[type] ?? type.toLowerCase()

type Api = ReturnType<typeof tagsInputConnect>

const TAGS = new InjectionToken<TagsInputRoot>("rind-ui.tags-input")

function injectHost(part: string): TagsInputRoot {
  const host = inject(TAGS, { optional: true })
  if (!host) throw new Error(`rindTagsInput${part} must be inside rindTagsInputRoot`)
  return host
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)
const optionalNumber = (v: number | string | undefined) =>
  v === undefined ? undefined : numberAttribute(v)

/**
 * A list of tags typed into one input: `<ng-container rindTagsInputRoot>` (no element of its
 * own) with a Label and a Control (Chips, Input); with suggestions, a Positioner holding the
 * Popup and its List.
 */
@Directive({
  selector: "[rindTagsInputRoot]",
  exportAs: "rindTagsInputRoot",
  providers: [
    { provide: TAGS, useExisting: forwardRef(() => TagsInputRoot) },
    { provide: POPUP_HOST, useExisting: forwardRef(() => TagsInputRoot) },
    { provide: LISTBOX_HOST, useFactory: () => inject(forwardRef(() => TagsInputRoot)).list },
  ],
})
export class TagsInputRoot implements PopupHost {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id = input<string>()
  /** The tags (`[(value)]`). */
  readonly value = input<readonly string[]>()
  readonly defaultValue = input<readonly string[]>()
  /** The draft (`[(inputValue)]`). */
  readonly inputValue = input<string>()
  readonly defaultInputValue = input<string>()
  /** Default ",". Strings match literally. */
  readonly delimiter = input<Delimiters>()
  /** Default: the delimiters plus newline, tab and ";". */
  readonly pasteDelimiter = input<Delimiters>()
  readonly addOnPaste = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly normalize = input<(text: string) => string>()
  readonly allowDuplicates = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly compare = input<(a: string, b: string) => boolean>()
  readonly max = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  readonly validate = input<(text: string, value: readonly string[]) => true | string>()
  readonly blurBehavior = input<"keep" | "add" | "clear">()
  readonly editable = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly removeOnBackspace = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly readOnly = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly invalid = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly required = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly name = input<string>()
  readonly inputName = input<string>()
  /** The id of the form the submitted tags (and the named text input) belong to. */
  readonly form = input<string>()
  readonly messages = input<Partial<TagsInputMessages>>()
  /** Suggestions: the input becomes a combobox; choosing one creates a tag from its key. */
  readonly items = input<readonly TagsInputItemData[]>()
  /** Suggestions built by the consumer (virtualized or async lists). */
  readonly collection = input<Collection<unknown>>()
  /** The suggestion matcher; `null` lists them unfiltered (consumer or server filtering). */
  readonly filter = input<ComboboxFilter>()
  /** The draft the given suggestions answer (async): another draft's are stale. */
  readonly itemsQuery = input<string>()
  readonly loading = input<LoadingStatus>()
  /** The suggestions' LoadMore sentinel came into view. */
  readonly onLoadMore = input<() => void>()
  /** Choosing a suggestion closes the popup (default false). */
  readonly closeOnSelect = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** With suggestions, typed text may become a tag (default true). */
  readonly allowCustom = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly autoHighlight = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Milliseconds a typing highlight waits before it reaches `aria-activedescendant`. */
  readonly typingPause = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  readonly positioning = input<PositioningProps>()
  readonly keepMounted = input(false, { transform: booleanAttribute })
  readonly valueChangeDetails = output<TagsInputValueEvent>()
  /** The tags, for `[(value)]`. */
  readonly valueChange = output<readonly string[]>()
  readonly inputValueChangeDetails = output<TagsInputInputValueEvent>()
  /** The draft, for `[(inputValue)]`. */
  readonly inputValueChange = output<string>()
  /** A tag was refused (a duplicate, the maximum, `validate`). */
  readonly refuse = output<TagRefusal>()

  /** @internal */
  readonly api: Signal<Api>
  /** @internal */
  readonly chipList: Signal<readonly ChipData[]>
  /** @internal */
  readonly editingKey: Signal<string | null>
  /** @internal */
  readonly formInput: ReturnType<typeof hiddenFormInput>
  /** @internal */
  constraint: HTMLInputElement | null = null
  /** @internal */
  pending = false
  /** @internal */
  readonly tags: Signal<readonly string[]>
  /** @internal */
  readonly reset: () => void
  /** @internal */
  readonly isOpen: () => boolean
  /** @internal */
  readonly present = signal(false)
  /** @internal */
  readonly topLayer = signal(false)
  /** @internal */
  readonly inlineMode = false
  /** @internal */
  readonly popupName = "TagsInput"
  /** @internal */
  readonly popupScope = "tags-input"
  /** @internal */
  readonly list: ListboxHost
  /** The chips, for an `@for` of Chips. */
  readonly chips: Signal<readonly ChipData[]>
  /** The listed suggestions' sections and items in render order, for an `@for`. */
  readonly groups: Signal<readonly ListboxGroup[]>
  private readonly disabledKeys = signal<ReadonlySet<string>>(new Set())

  constructor() {
    const base = injectEnvironment(announcerCapability, layoutCapability)
    const env = withCapabilities(base, { position: domPositioning(base) })
    const instance = injectRootId(() => this.id())
    const binding = injectFieldControl()
    const fieldsetDisabled = injectFieldsetDisabled()
    const appRef = inject(ApplicationRef)
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "textbox",
          labelable: true,
          disabled: this.disabled() === true || fieldsetDisabled(),
          readOnly: this.readOnly(),
          required: this.required(),
          invalid: this.invalid(),
          name: this.name(),
        },
        binding?.() ?? null,
      ),
    )
    let ids: ReturnType<typeof tagsInputIds> | undefined
    const idsNow = () => {
      ids ??= tagsInputIds(instance())
      return ids
    }
    const locale = () => env.locale.locale()
    const messages = computed(() => ({ ...tagsInputMessages, ...this.messages() }))
    const mounted = signal<{
      label: boolean
      empty: boolean
      descriptions: ReadonlySet<CollectionKey>
    }>({ label: false, empty: false, descriptions: new Set() })
    // Suggestions: every option, and the listed ones (the draft's, without the chosen tags).
    const data = computed(() => {
      const items = this.items()
      return items ? fromData(items) : null
    })
    const full = () => this.collection() ?? data()
    // The draft and the tags the results answer: mirrored from the service (the props read
    // them, and the view reads the props).
    const query = signal("")
    const chosen = signal<readonly string[]>([])
    const openNow = signal(false)
    const live = computed(() => {
      const f = full()
      return f
        ? tagSuggestions(
            patternResults(f, query(), this.filter(), locale()),
            chosen(),
            this.allowDuplicates() === true,
          )
        : NO_ITEMS
    })
    // While closing, the listed options are those of the moment it started closing.
    let frozen: ReturnType<typeof tagSuggestions> | undefined
    const results = computed(() => {
      const l = live()
      if (openNow() || frozen === undefined) frozen = l
      return openNow() || !full() ? l : frozen
    })
    const machineProps = () => {
      const value = this.value()
      const inputValue = this.inputValue()
      return {
        ...(value !== undefined ? { value } : {}),
        defaultValue: this.defaultValue() ?? [],
        ...(inputValue !== undefined ? { inputValue } : {}),
        defaultInputValue: this.defaultInputValue(),
        delimiter: this.delimiter(),
        pasteDelimiter: this.pasteDelimiter(),
        addOnPaste: this.addOnPaste(),
        normalize: this.normalize(),
        allowDuplicates: this.allowDuplicates(),
        compare: this.compare(),
        max: this.max(),
        validate: this.validate(),
        onRefuse: (r: TagRefusal) => this.refuse.emit(r),
        blurBehavior: this.blurBehavior(),
        editable: this.editable(),
        removeOnBackspace: this.removeOnBackspace(),
        disabledKeys: this.disabledKeys(),
        disabled: field().disabled,
        readOnly: field().readOnly,
        locale: locale(),
        messages: messages(),
        items: full() ?? undefined,
        collection: results(),
        ids: idsNow(),
        strategy: "active-descendant" as const,
        root: instance(),
        closeOnSelect: this.closeOnSelect(),
        allowCustom: this.allowCustom(),
        autoHighlight: this.autoHighlight(),
        typingPause: this.typingPause(),
        positioning: this.positioning(),
        loading: this.loading(),
        onLoadMore: this.onLoadMore(),
        stale: isStale({ itemsQuery: this.itemsQuery(), query: query() }),
        onValueChange: (v: readonly string[], d: { event: { type: string } }) => {
          this.pending = true
          binding?.().report({ type: "change", value: v, user: true, composing: false })
          // A value changed by a text change is always a delimiter split.
          this.valueChangeDetails.emit({
            value: v,
            details: { reason: reasonOf(d.event.type, true) },
          })
          this.valueChange.emit(v)
        },
        onInputValueChange: (t: string, d: { event: { type: string } }) => {
          this.inputValueChangeDetails.emit({
            value: t,
            details: { reason: reasonOf(d.event.type, false) },
          })
          this.inputValueChange.emit(t)
        },
      }
    }
    // Sound: the props built here are the tags-input machine's (React's own cast).
    const { view, service, send } = injectMachine(tagsInputMachine, machineProps as never, env)
    const mirror = () => {
      const v = service().view()
      openNow.set(v.state === "suggesting")
      query.set((v.values.inputValue as string | undefined) ?? "")
      chosen.set((v.values.value as readonly string[] | undefined) ?? [])
    }
    this.reset = () => send({ type: "FORM.RESET" })
    const open = () => view().state === "suggesting"
    this.isOpen = open
    const exposure = () => ({
      open: open(),
      results: results(),
      query: query(),
      itemsQuery: this.itemsQuery(),
      loading: this.loading(),
    })
    this.tags = computed(() => view().values.value as readonly string[])
    this.chipList = computed(() =>
      tagChips(
        {
          ...(machineProps() as object),
          disabled: field().disabled,
          readOnly: field().readOnly,
        },
        this.tags(),
      ),
    )
    this.chips = this.chipList
    this.groups = computed(() => groupsOf(results()))
    this.editingKey = computed(() =>
      view().state === "editing" ? (view().context.editingKey ?? null) : null,
    )
    this.formInput = hiddenFormInput(
      {
        input: () => this.constraint,
        // Sound: the Input part renders an <input> with this id.
        control: () => env.dom.getById(idsNow().input) as HTMLElement | null,
      },
      env,
    )
    const modality = injectModality(env.modality, () => view().context.focused)
    this.api = computed(() => {
      const v = view()
      const f = field()
      const m = mounted()
      const t = this.tags()
      const normalize = this.normalize() ?? ((s: string) => s.trim())
      const max = this.max()
      return tagsInputConnect(
        {
          instance: instance(),
          state: v.state as "idle" | "typing" | "suggesting" | "editing",
          context: v.context,
          tags: t,
          chips: this.chipList(),
          inputValue: v.values.inputValue as string,
          disabled: f.disabled,
          readOnly: f.readOnly,
          invalid: f.invalid,
          required: f.required,
          atMax: max !== undefined && t.length >= max,
          draftNotEmpty: normalize(v.values.inputValue as string) !== "",
          delimiter: this.delimiter() ?? ",",
          pasteDelimiter: this.pasteDelimiter(),
          addOnPaste: this.addOnPaste() !== false,
          modality: modality(),
          dir: env.locale.dir(),
          locale: locale(),
          messages: messages(),
          mounted: {
            label: m.label,
            empty: m.empty,
            description: (key) => m.descriptions.has(key),
          },
          suggestions: full() != null,
          results: results(),
          exposed: isExposed(exposure()),
          empty: isEmptyState(exposure()),
          present: this.present() || open(),
          loading: this.loading(),
          topLayer: this.topLayer(),
          name: f.name,
          inputName: this.inputName(),
          form: this.form(),
          field: f,
          fieldData: binding?.().data,
          // The edit input exists right after (React's flushSync): its props apply now.
          commitSync: (fn) => {
            fn()
            appRef.tick()
          },
          send,
        },
        env,
      )
    })
    let loadedFor: Collection<unknown> | null = null
    this.list = {
      name: "TagsInput",
      // Sound: the tags-input api has every listbox part the shared parts call.
      parts: () =>
        ({ ...this.api(), isEmpty: isEmptyState(exposure()) }) as unknown as ReturnType<
          ListboxHost["parts"]
        >,
      collection: () => results(),
      registry: () => null,
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
      requestLoadMore: () => {
        if ((untracked(this.loading) ?? "idle") !== "idle" || loadedFor === untracked(full)) {
          return
        }
        loadedFor = untracked(full) ?? null
        untracked(this.onLoadMore)?.()
      },
      instance: () => instance(),
    }
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      mirror()
      destroy.onDestroy(service().subscribe(mirror))
      // Known after render: the server render and hydration never carry `popover`.
      this.topLayer.set(
        typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype,
      )
      if (!binding) return
      const id = idsNow().input
      destroy.onDestroy(
        binding().register(
          {
            id,
            labelable: true,
            focus: (m) => {
              // Sound: the Input part renders an <input> with this id.
              const el = env.dom.getById(id) as HTMLElement | null
              if (el) void focusSafely(el, env, "programmatic", m)
            },
            validityElement: () => this.constraint,
            value: () => untracked(view).values.value,
          },
          id,
        ),
      )
    })
  }

  /** @internal */
  setDisabled(key: string, on: boolean): void {
    const d = untracked(this.disabledKeys)
    if (d.has(key) === on) return
    const next = new Set(d)
    if (on) next.add(key)
    else next.delete(key)
    this.disabledKeys.set(next)
  }
}

/**
 * The input's frame: `<div rindTagsInputControl>` holding the Chips and the Input; it renders
 * the chips' summary and the form's hidden inputs after its content.
 */
@Component({
  selector: "[rindTagsInputControl]",
  exportAs: "rindTagsInputControl",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  // Positional carriers: duplicates are allowed.
  template: `<ng-content /><span [rindProps]="summaryProps()">{{ summary() }}</span><input #constraint [rindProps]="hiddenProps()" />@for (c of carriers(); track $index) {<input [rindProps]="c" />}`,
})
export class TagsInputControl {
  /** @internal */
  protected readonly host = injectHost("Control")
  /** @internal */
  protected readonly summaryProps = computed(() => this.host.api().chipsSummary())
  /** @internal */
  protected readonly summary = computed(() => this.host.api().summaryText)
  /** @internal */
  protected readonly hiddenProps = computed(() => this.host.api().hiddenInput())
  /** @internal */
  protected readonly carriers = computed(() => this.host.api().carriers())
  private readonly constraintRef = viewChild<ElementRef<HTMLInputElement>>("constraint")

  constructor() {
    const host = this.host
    bindProps(() => host.api().control())
    if (inject(PLATFORM_ID) !== "browser") return
    // The carriers reflect every change; a user change dispatches input and change.
    afterEveryRender(() => {
      host.constraint = this.constraintRef()?.nativeElement ?? null
      host.formInput.sync({ values: untracked(host.tags) }, { dispatch: host.pending })
      host.pending = false
    })
    const destroy = inject(DestroyRef)
    afterNextRender(() =>
      destroy.onDestroy(
        host.formInput.track({
          onReset: host.reset,
          current: () => ({ values: untracked(host.tags) }),
        }),
      ),
    )
  }
}

/** The draft input: `<input rindTagsInputInput>`. */
@Directive({ selector: "[rindTagsInputInput]", exportAs: "rindTagsInputInput" })
export class TagsInputInput {
  constructor() {
    const host = injectHost("Input")
    bindProps(() => host.api().input())
  }
}

/** Removes every tag: `<button rindTagsInputClearTrigger>`. */
@Directive({ selector: "[rindTagsInputClearTrigger]", exportAs: "rindTagsInputClearTrigger" })
export class TagsInputClearTrigger {
  constructor() {
    const host = injectHost("ClearTrigger")
    bindProps(() => host.api().clearTrigger())
  }
}

/**
 * The chips toolbar: `<div rindTagsInputChips>`, before the Input, holding one Chip per tag
 * (`@for (c of t.chips(); track c.key)`); empty, it renders each chip's text, edit input and
 * remove button itself.
 */
@Component({
  selector: "[rindTagsInputChips]",
  exportAs: "rindTagsInputChips",
  imports: [
    forwardRef(() => TagsInputChip),
    forwardRef(() => TagsInputChipText),
    forwardRef(() => TagsInputChipInput),
    forwardRef(() => TagsInputChipRemove),
  ],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>@for (c of host.chips(); track c.key) {<span rindTagsInputChip [chip]="c"><span rindTagsInputChipText></span><input rindTagsInputChipInput /><button rindTagsInputChipRemove></button></span>}</ng-content>`,
})
export class TagsInputChips {
  /** @internal */
  protected readonly host = injectHost("Chips")
  constructor() {
    bindProps(() => this.host.api().chips())
  }
}

const CHIP = new InjectionToken<TagsInputChip>("rind-ui.tags-input-chip")

function injectChip(part: string): TagsInputChip {
  const chip = inject(CHIP, { optional: true })
  if (!chip) throw new Error(`rindTagsInput${part} must be inside rindTagsInputChip`)
  return chip
}

/** One tag: `<span rindTagsInputChip [chip]="c">`. */
@Directive({
  selector: "[rindTagsInputChip]",
  exportAs: "rindTagsInputChip",
  providers: [{ provide: CHIP, useExisting: forwardRef(() => TagsInputChip) }],
})
export class TagsInputChip {
  /** The chip (from the Root's `chips()`). */
  readonly chip = input.required<ChipData>()
  /** Locks this tag: it cannot be edited or removed, and clearing keeps it. */
  readonly disabled = input(false, { transform: booleanAttribute })
  constructor() {
    const host = injectHost("Chip")
    effect((onCleanup) => {
      const key = this.chip().key
      const disabled = this.disabled()
      untracked(() => host.setDisabled(key, disabled))
      onCleanup(() => untracked(() => host.setDisabled(key, false)))
    })
    bindProps(() => host.api().chip(this.chip().key), { owns: ["disabled"] })
  }
}

/** The tag's text: `<span rindTagsInputChipText>` (the tag unless it has content). */
@Component({
  selector: "[rindTagsInputChipText]",
  exportAs: "rindTagsInputChipText",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>{{ chip.chip().text }}</ng-content>`,
})
export class TagsInputChipText {
  /** @internal */
  protected readonly chip = injectChip("ChipText")
  constructor() {
    const host = injectHost("ChipText")
    bindProps(() => host.api().chipText(this.chip.chip().key))
  }
}

/** The edit input: `<input rindTagsInputChipInput>`, present only while its tag is edited. */
@Directive({ selector: "[rindTagsInputChipInput]", exportAs: "rindTagsInputChipInput" })
export class TagsInputChipInput {
  constructor() {
    const host = injectHost("ChipInput")
    const chip = injectChip("ChipInput")
    bindProps(() => {
      const key = chip.chip().key
      return host.editingKey() !== key
        ? absentProps("tags-input", host.list.instance())
        : host.api().chipInput(key)
    })
  }
}

/** Removes its tag: `<button rindTagsInputChipRemove>` (default content `×`, hidden). */
@Component({
  selector: "[rindTagsInputChipRemove]",
  exportAs: "rindTagsInputChipRemove",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content><span aria-hidden="true">×</span></ng-content>`,
})
export class TagsInputChipRemove {
  constructor() {
    const host = injectHost("ChipRemove")
    const chip = injectChip("ChipRemove")
    bindProps(() => host.api().chipRemove(chip.chip().key))
  }
}

/** The Tags Input's parts (its suggestions are the Listbox's, its popup the Combobox's). */
export const TagsInput = [
  TagsInputRoot,
  ListboxLabel,
  TagsInputControl,
  TagsInputInput,
  TagsInputClearTrigger,
  TagsInputChips,
  TagsInputChip,
  TagsInputChipText,
  TagsInputChipInput,
  TagsInputChipRemove,
  ComboboxPositioner,
  ComboboxPopup,
  ListboxList,
  ListboxItem,
  ListboxItemText,
  ListboxSection,
  ListboxSeparator,
  ListboxEmpty,
] as const
