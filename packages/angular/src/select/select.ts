// Select: Root (service, hidden form inputs), Label, Trigger, ValueText, Indicator, Description,
// Portal, Positioner, Content and the listbox parts bound to this host. Wiring only: the
// machine owns opening, value and highlight; the core parts own every attribute.
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  type ComponentRef,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  isDevMode,
  numberAttribute,
  type OnInit,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewContainerRef,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  domPositioning,
  focusSafely,
  hiddenFormInput,
  layoutCapability,
  mergeFieldProps,
  type PartProps,
  type SelectOpenChangeDetails,
  type SelectValue,
  selectConnect,
  selectIds,
  selectionOf,
  selectLayerId,
  selectMachine,
  selectPositioning,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectCollectionItems } from "../collection-items"
import { injectFieldBindingPeek, injectFieldControl } from "../field/context"
import { injectFieldsetDisabled } from "../fieldset/context"
import { HiddenInput } from "../hidden-input"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality, injectPress } from "../inject-press"
import {
  injectLayerMeta,
  injectParentLayer,
  injectRendered,
  LAYER,
  layerProvider,
} from "../layer-context"
import type { ListboxItemData } from "../listbox/listbox"
import {
  groupsOf,
  LISTBOX_HOST,
  ListboxEmpty,
  type ListboxGroup,
  type ListboxHost,
  ListboxItem,
  ListboxItemDescription,
  ListboxItemIndicator,
  ListboxItemText,
  ListboxList,
  ListboxLoadMore,
  ListboxSection,
  ListboxSeparator,
} from "../listbox/parts"
import { PORTAL_PROVIDERS, PortalBase } from "../portal"
import { injectEnvironment, withCapabilities } from "../provider"

const fromData = (items: readonly ListboxItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])

/** `valueChange`'s details: why the value changed. */
export interface SelectValueChangeDetails {
  readonly reason: "select" | "typeahead" | "reset" | "autofill"
}

/** What a `valueChangeDetails` output emits. */
export interface SelectValueEvent {
  readonly value: string | null | readonly string[]
  readonly details: SelectValueChangeDetails
}

/** What an `openChangeDetails` output emits. */
export interface SelectOpenEvent {
  readonly value: boolean
  readonly details: SelectOpenChangeDetails
}

export interface SelectState {
  readonly open: boolean
  readonly placeholder: boolean
}

const VALUE_REASON: Record<string, SelectValueChangeDetails["reason"]> = {
  SELECT: "select",
  TYPEAHEAD: "typeahead",
  "FORM.RESET": "reset",
  "FORM.AUTOFILL": "autofill",
}

interface Mounted {
  readonly label: boolean
  readonly description: boolean
  readonly list: boolean
  readonly empty: boolean
  readonly descriptions: ReadonlySet<CollectionKey>
}

const SELECT = new InjectionToken<SelectRoot>("rind-ui.select")

function injectSelect(part: string): SelectRoot {
  const root = inject(SELECT, { optional: true })
  if (!root) throw new Error(`rindSelect${part} must be inside rindSelectRoot`)
  return root
}

const listFormatter = (locale: string) => {
  const f = new Intl.ListFormat(locale, { style: "long", type: "conjunction" })
  return (texts: readonly string[]) => f.format(texts)
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A single or multiple choice from a popup list: `<ng-container rindSelectRoot>` (no element
 * of its own; the hidden form inputs follow its content) with a Label, a Trigger and, usually
 * in `<ng-template rindSelectPortal>`, a Positioner holding the Content and its List.
 */
@Directive({
  selector: "[rindSelectRoot]",
  exportAs: "rindSelectRoot",
  providers: [{ provide: SELECT, useExisting: forwardRef(() => SelectRoot) }],
})
export class SelectRoot implements OnInit {
  /** The base the parts' ids derive from. Default: generated. */
  readonly id = input<string>()
  /** Data items: the value text needs no option rendered (a closed select renders none). */
  readonly items = input<readonly ListboxItemData[]>()
  /** A collection built by the consumer (virtualized lists). */
  readonly collection = input<Collection<unknown>>()
  /** Several values (`string[]`) instead of one. */
  readonly multiple = input(false, { transform: booleanAttribute })
  /** The value (`[(value)]`): a key or null; with `multiple`, the keys. */
  readonly value = input<string | null | readonly string[]>()
  readonly defaultValue = input<string | null | readonly string[]>()
  /** Controlled visibility (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default true. */
  readonly modal = input(true, { transform: booleanAttribute })
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** A disabled trigger stays focusable (`aria-disabled`), and disabled options stay navigable. */
  readonly focusableWhenDisabled = input(false, { transform: booleanAttribute })
  readonly readOnly = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly required = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly invalid = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly name = input<string>()
  readonly form = input<string>()
  readonly autoComplete = input<string>()
  /** Shown while nothing is selected. */
  readonly placeholder = input<string>()
  /** Default false (a native select does not wrap). */
  readonly loop = input(false, { transform: booleanAttribute })
  readonly typeaheadTimeout = input(1000, { transform: numberAttribute })
  readonly positioning = input<Parameters<typeof selectPositioning>[0]["positioning"]>()
  /** Positioner and content stay rendered (hidden) while closed. */
  readonly keepMounted = input(false, { transform: booleanAttribute })
  readonly valueChangeDetails = output<SelectValueEvent>()
  /** The accepted value, for `[(value)]`. */
  readonly valueChange = output<string | null | readonly string[]>()
  readonly openChangeDetails = output<SelectOpenEvent>()
  /** The accepted visibility, for `[(open)]`. */
  readonly openChange = output<boolean>()

  /** @internal */
  readonly instance: () => string
  /** @internal */
  readonly view: ReturnType<typeof injectMachine<typeof selectMachine>>["view"]
  /** @internal */
  readonly service: ReturnType<typeof injectMachine<typeof selectMachine>>["service"]
  /** @internal */
  readonly send: ReturnType<typeof injectMachine<typeof selectMachine>>["send"]
  /** @internal */
  readonly collectionNow: () => Collection<unknown>
  /** @internal */
  readonly registry: () => ReturnType<typeof injectCollectionItems>["registry"] | null
  /** @internal */
  readonly disabledState: () => boolean
  /** @internal */
  readonly field: Signal<ReturnType<typeof mergeFieldProps>>
  /** @internal */
  readonly trigger = signal<HTMLElement | null>(null)
  // A native <fieldset disabled> around the trigger, not only rind's Fieldset (radix#2417).
  private readonly fieldsetDom = signal(false)
  /** @internal */
  readonly label = signal<HTMLElement | null>(null)
  /** @internal */
  hidden: HTMLInputElement | null = null
  /** @internal */
  readonly mounted = signal<Mounted>({
    label: false,
    description: false,
    list: false,
    empty: false,
    descriptions: new Set(),
  })
  /** @internal The trigger's consumer naming (the list copies `aria-label`). */
  triggerNaming: { label?: string | undefined; labelledBy?: string | undefined } = {}
  /** @internal */
  readonly meta: ReturnType<typeof injectLayerMeta>
  /** The data items' sections and options in render order (data items only), for an `@for`. */
  readonly groups: Signal<readonly ListboxGroup[]>
  /** The select's state, for the template (`#s="rindSelectRoot"`, `s.state()`). */
  readonly state: Signal<SelectState>
  private readonly env = injectEnvironment(announcerCapability, layoutCapability)

  constructor() {
    const env = this.env
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const parent = injectParentLayer()
    const enclosing = injectFieldBindingPeek()
    const fieldsetDisabled = injectFieldsetDisabled()
    this.field = computed(() => {
      const name = this.name()
      return mergeFieldProps(
        {
          role: "combobox",
          labelable: true,
          disabled: this.disabled(),
          readOnly: this.readOnly(),
          required: this.required(),
          invalid: this.invalid(),
          ...(name === undefined ? {} : { name }),
        },
        enclosing?.() ?? null,
      )
    })
    this.disabledState = () => this.field().disabled || fieldsetDisabled() || this.fieldsetDom()
    const { collection: registered, registry } = injectCollectionItems()
    const data = computed(() => {
      const items = this.items()
      return items ? fromData(items) : null
    })
    this.collectionNow = () => this.collection() ?? data() ?? registered() ?? EMPTY
    this.registry = () => (this.collection() || data() ? null : registry)
    this.groups = computed(() => groupsOf(data() ?? EMPTY))
    let ids: { list: string; item: (key: CollectionKey) => string } | undefined
    const formInput = hiddenFormInput(
      { input: () => this.hidden, control: () => untracked(this.trigger) },
      env,
    )
    const machineEnv = withCapabilities(env, { position: domPositioning(env) })
    // A user change dispatches input + change from the hidden input after it commits.
    let userChange = false
    const { view, send, service } = injectMachine(
      selectMachine,
      () => {
        const s = selectIds(instance())
        ids ??= { list: s.list, item: s.item }
        const value = this.value()
        const open = this.open()
        return {
          collection: this.collectionNow(),
          ids,
          strategy: "roving" as const,
          selectionMode: this.multiple() ? ("multiple" as const) : ("single" as const),
          selectionBehavior: "toggle" as const,
          loop: this.loop(),
          focusableWhenDisabled: this.focusableWhenDisabled(),
          typeaheadTimeout: this.typeaheadTimeout(),
          ...(value !== undefined ? { value: value as SelectValue } : {}),
          defaultValue:
            (this.defaultValue() as SelectValue | undefined) ?? (this.multiple() ? [] : null),
          onValueChange: (v: SelectValue, details: { event: { type: string } }) => {
            const reason = VALUE_REASON[details.event.type] ?? "select"
            if (reason !== "reset") userChange = true
            const out = v as string | null | readonly string[]
            this.valueChangeDetails.emit({ value: out, details: { reason } })
            this.valueChange.emit(out)
          },
          ...(open !== undefined ? { open } : {}),
          defaultOpen: this.defaultOpen(),
          onOpenChange: (o: boolean, d: SelectOpenChangeDetails) => {
            this.openChangeDetails.emit({ value: o, details: d })
            this.openChange.emit(o)
          },
          modal: this.modal(),
          disabled: this.disabledState(),
          readOnly: this.field().readOnly,
          positioning: this.positioning(),
          root: instance(),
          parent: parent(),
          getTrigger: () => untracked(this.trigger),
          getLabel: () => untracked(this.label),
        }
      },
      machineEnv,
    )
    this.view = view
    this.service = service
    this.send = send
    this.meta = injectLayerMeta(
      () => view().matches("open"),
      () => selectLayerId(instance()),
    )
    this.state = computed(() => ({
      open: view().matches("open"),
      placeholder: this.api().placeholder,
    }))
    // The hidden inputs follow the content (React renders them after the Root's children).
    const container = inject(ViewContainerRef)
    const keys = computed(() => {
      const k = selectionOf(view().values.value)
      return k === "all" ? [] : [...k]
    })
    // Created on init, once the content's nodes are in place: the inputs go after them.
    this.createHidden = () => {
      const ref = container.createComponent(HiddenInput)
      this.hidden = ref.location.nativeElement as HTMLInputElement
      main.set(ref)
    }
    const main = signal<ComponentRef<HiddenInput> | null>(null)
    effect(() => {
      const ref = main()
      if (!ref) return
      const a = this.api()
      ref.setInput(
        "props",
        a.hiddenInput({
          name: this.field().name,
          form: this.form(),
          autoComplete: this.autoComplete(),
        }),
      )
    })
    // With `multiple` and a name: one value carrier per selected key.
    const carriers = new Map<CollectionKey, ComponentRef<HiddenInput>>()
    effect(() => {
      if (!main()) return
      const name = this.field().name
      const list = this.multiple() && name ? keys() : []
      const a = this.api()
      const form = this.form()
      untracked(() => {
        for (const [k, ref] of carriers) {
          if (list.includes(k)) continue
          ref.destroy()
          carriers.delete(k)
        }
        for (const k of list) {
          let ref = carriers.get(k)
          if (!ref) {
            ref = container.createComponent(HiddenInput)
            carriers.set(k, ref)
          }
          // `name` is set: the list is empty without one.
          ref.setInput("props", a.hiddenValue(k, { name: name as string, form }))
        }
      })
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // The form's view of the value: one key (single) or the constraint plus value carriers.
    const mirror = () => {
      const list = untracked(keys)
      return {
        value: untracked(this.multiple) ? (list.length > 0 ? "x" : "") : (list[0] ?? ""),
      }
    }
    // After every render: the input shows the value; a user change also fires input + change.
    afterEveryRender(() => {
      const dispatch = userChange
      userChange = false
      formInput.sync(mirror(), { dispatch })
    })
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      const node = untracked(this.trigger)
      if (!node) return
      const watch = watchFieldsetDisabled(node, (d) => this.fieldsetDom.set(d))
      this.fieldsetDom.set(watch.disabled)
      destroy.onDestroy(watch.stop)
    })
    afterNextRender(() =>
      destroy.onDestroy(
        formInput.track({
          onReset: () => send({ type: "FORM.RESET" }),
          current: mirror,
          onNativeInput: (el) => {
            send({ type: "FORM.AUTOFILL", text: el.value })
            // Re-sync either way: an unmatched text (or a multiple select) leaves the machine as it
            // was, and the input must not keep what the browser wrote (select spec "Browser Autofill").
            return false
          },
        }),
      ),
    )
  }

  private readonly createHidden: () => void

  ngOnInit(): void {
    this.createHidden()
  }

  /** @internal The select's connect, with a part's focus state. */
  api(
    extra: {
      dir?: "ltr" | "rtl"
      listFocused?: boolean
      modality?: ReturnType<ReturnType<typeof injectModality>>
    } = {},
  ) {
    const view = this.view()
    const m = this.mounted()
    const env = this.env
    return selectConnect(
      {
        instance: this.instance(),
        open: view.matches("open"),
        collection: this.collectionNow(),
        selection: selectionOf(view.values.value),
        multiple: this.multiple(),
        highlightedKey: view.context.highlightedKey,
        highlightSource: view.context.highlightSource,
        typingAhead: () => {
          const t = this.service().getSnapshot().context.typeahead
          return t.buffer !== "" && env.clock.now() - t.at <= untracked(this.typeaheadTimeout)
        },
        placement: view.context.placement,
        closeReason: view.context.closeReason,
        modal: this.modal(),
        disabled: this.disabledState(),
        readOnly: this.field().readOnly,
        required: this.field().required,
        invalid: this.field().invalid,
        autofilled: view.context.autofilled,
        focusableWhenDisabled: this.focusableWhenDisabled(),
        texts: view.context.texts,
        placeholder: this.placeholder(),
        listFormat: listFormatter(env.locale.locale()),
        mounted: {
          label: m.label,
          description: m.description,
          list: m.list,
          empty: m.empty,
          itemDescription: (key) => m.descriptions.has(key),
        },
        meta: this.meta(),
        manual: selectPositioning({ positioning: this.positioning() }).mode === "manual",
        listFocused: extra.listFocused === true,
        modality: extra.modality ?? "keyboard",
        ...(extra.dir ? { dir: extra.dir } : {}),
      },
      this.send,
      env,
    )
  }

  /** @internal */
  setMounted(part: "label" | "description" | "list" | "empty", on: boolean): void {
    const m = untracked(this.mounted)
    if (m[part] !== on) this.mounted.set({ ...m, [part]: on })
  }

  /** @internal */
  mountDescription(key: CollectionKey, on: boolean): void {
    const m = untracked(this.mounted)
    if (m.descriptions.has(key) === on) return
    const next = new Set(m.descriptions)
    if (on) next.add(key)
    else next.delete(key)
    this.mounted.set({ ...m, descriptions: next })
  }

  /** Opens it. */
  show(): void {
    this.send({ type: "OPEN" })
  }
  /** Closes it. */
  hide(): void {
    this.send({ type: "CLOSE" })
  }
}

/** Registers a part as rendered with the Root while it is. */
function injectMounted(root: SelectRoot, part: "label" | "description" | "list" | "empty") {
  if (inject(PLATFORM_ID) !== "browser") return
  afterNextRender(() => root.setMounted(part, true))
  inject(DestroyRef).onDestroy(() => root.setMounted(part, false))
}

/** Keeps the part's element in `target` while rendered. */
function injectElement(target: { set(el: HTMLElement | null): void }, el: Element) {
  if (inject(PLATFORM_ID) !== "browser") return
  target.set(el instanceof HTMLElement ? el : null)
  inject(DestroyRef).onDestroy(() => target.set(null))
}

/** The select's visible name: `<span rindSelectLabel>`. */
@Directive({ selector: "[rindSelectLabel]", exportAs: "rindSelectLabel" })
export class SelectLabel {
  constructor() {
    const root = injectSelect("Label")
    injectMounted(root, "label")
    injectElement(root.label, inject(ElementRef).nativeElement)
    bindProps(() => root.api().label())
  }
}

/** Opens the list: `<button rindSelectTrigger>`, holding the ValueText and the Indicator. */
@Directive({ selector: "[rindSelectTrigger]", exportAs: "rindSelectTrigger" })
export class SelectTrigger {
  constructor() {
    const root = injectSelect("Trigger")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const binding = injectFieldControl()
    const press = injectPress({
      env,
      send: (e) => {
        if (e.type === "PRESS") untracked(() => root.api()).pressTrigger(e.modality)
      },
      disabled: () => root.disabledState(),
      // A label's forwarded click focuses the trigger and never opens the popup.
      labelActivation: "focus",
    })
    injectElement(root.trigger, el)
    let naming: { label?: string; labelledBy?: string; describedBy?: string } = {}
    // Space continuing a search must not press the trigger (the trigger's handler acts first).
    const { onKeyDown: pressKeyDown, ...pressProps } = press.props
    const { statics } = bindProps(
      () => {
        const a = root.api()
        const own = a.trigger({
          tag,
          focused: focused(),
          modality: modality(),
          pressed: press.pressed(),
          ...naming,
        })
        const fieldAria = binding
          ? mergeFieldProps(
              // Sound: the connect writes the trigger's id list as a string (or leaves it out).
              {
                role: "combobox",
                labelable: true,
                describedBy: own["aria-describedby"] as string | undefined,
              },
              binding(),
            )
          : null
        return {
          ...joinHandlers(own, pressProps, {
            onKeyDown: (e: KeyboardEvent) => {
              if (!e.defaultPrevented) pressKeyDown(e as never)
            },
            onFocus: () => focused.set(true),
            onBlur: () => focused.set(false),
          }),
          ...(fieldAria
            ? {
                "aria-describedby": fieldAria["aria-describedby"],
                "aria-required": own["aria-required"] ?? fieldAria["aria-required"],
              }
            : {}),
        }
      },
      { owns: ["aria-label", "aria-labelledby", "aria-describedby"] },
    )
    const label = statics.get("aria-label")
    const labelledBy = statics.get("aria-labelledby")
    const describedBy = statics.get("aria-describedby")
    naming = {
      ...(label === undefined ? {} : { label }),
      ...(labelledBy === undefined ? {} : { labelledBy }),
      ...(describedBy === undefined ? {} : { describedBy }),
    }
    root.triggerNaming = { label, labelledBy }
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    const controlId = selectIds(untracked(root.instance)).trigger
    afterNextRender(() => {
      // The modality tracker needs a subscriber while the trigger is rendered.
      destroy.onDestroy(env.modality.subscribe(() => {}))
      if (binding) {
        destroy.onDestroy(
          binding().register(
            {
              id: controlId,
              labelable: true,
              focus: (m) => {
                const t = untracked(root.trigger)
                if (t) void focusSafely(t, env, "programmatic", m)
              },
              validityElement: () => root.hidden,
              value: () => untracked(root.view).values.value ?? null,
            },
            controlId,
          ),
        )
      }
      // Development: a trigger needs a name (it is never named by its value). Checked a frame
      // after render: the Label registers then and the trigger's aria-labelledby follows.
      if (!isDevMode()) return
      const frame = env.scheduler.requestAnimationFrame(() => {
        const named =
          el.hasAttribute("aria-label") ||
          el.hasAttribute("aria-labelledby") ||
          el.closest("label") !== null ||
          ((el as HTMLButtonElement).labels?.length ?? 0) > 0
        if (!named) {
          console.warn(
            `[rind-ui] select #${el.id}: the trigger has no accessible name; render rindSelectLabel or pass aria-label`,
          )
        }
      })
      destroy.onDestroy(() => env.scheduler.cancelAnimationFrame(frame))
    })
    // Each change and each close (a commit) reported to the Field once.
    const ready = injectRendered()
    let lastValue: string | undefined
    let wasOpen = false
    effect(() => {
      const value = JSON.stringify(root.view().values.value ?? null)
      const open = root.view().matches("open")
      if (!ready()) {
        lastValue = value
        wasOpen = open
        return
      }
      untracked(() => {
        if (value !== lastValue) {
          lastValue = value
          binding?.().report({
            type: "change",
            value: JSON.parse(value),
            user: true,
            composing: false,
          })
        }
        if (wasOpen && !open) binding?.().report({ type: "commit" })
        wasOpen = open
      })
    })
  }
}

/**
 * The selected text: `<span rindSelectValueText>` (the placeholder while nothing is selected).
 * Content of its own replaces the text; `#v="rindSelectValueText"`, `v.selected()`.
 */
@Component({
  selector: "[rindSelectValueText]",
  exportAs: "rindSelectValueText",
  encapsulation: ViewEncapsulation.None,
  // A new node per value: WebKit re-reads a replaced node, not an updated one (zag#3099).
  template: `<ng-content>@for (t of [text()]; track t) {<span>{{ t }}</span>}</ng-content>`,
})
export class SelectValueText {
  /** The selected keys. */
  readonly selected: Signal<readonly string[]>
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectSelect("ValueText")
    this.selected = computed(() => {
      const keys = selectionOf(root.view().values.value)
      return keys === "all" ? [] : [...keys]
    })
    this.text = computed(() => root.api().valueTextContent())
    bindProps(() => root.api().valueText())
  }
}

@Directive({ selector: "[rindSelectIndicator]", exportAs: "rindSelectIndicator" })
export class SelectIndicator {
  constructor() {
    const root = injectSelect("Indicator")
    bindProps(() => root.api().indicator())
  }
}

@Directive({ selector: "[rindSelectDescription]", exportAs: "rindSelectDescription" })
export class SelectDescription {
  constructor() {
    const root = injectSelect("Description")
    injectMounted(root, "description")
    bindProps(() => root.api().description())
  }
}

/** Places the content against the trigger: `<div rindSelectPositioner>`. */
@Directive({ selector: "[rindSelectPositioner]", exportAs: "rindSelectPositioner" })
export class SelectPositioner {
  constructor() {
    const root = injectSelect("Positioner")
    const el: Element = inject(ElementRef).nativeElement
    // The trigger's direction: the portalled positioner carries it (inline sides, RTL).
    const dir = signal<"ltr" | "rtl" | undefined>(undefined)
    const ready = injectRendered()
    effect(() => {
      if (!ready() || !root.view().matches("open")) return
      const found = root.trigger()?.closest("[dir]")?.getAttribute("dir")
      dir.set(found === "rtl" ? "rtl" : "ltr")
    })
    const open = () => root.view().matches("open")
    // It holds the content: it stays while the content's exit animations run.
    const presence = injectPresence(open, el, {
      keepMounted: () => root.keepMounted(),
      subtree: () => true,
    })
    bindProps(() => {
      if (!presence.mounted()) return absentProps("select", root.instance())
      const d = dir()
      return {
        ...root.api(d ? { dir: d } : {}).positioner(),
        hidden: !open() && root.keepMounted(),
      }
    })
  }
}

/** Whether the Content around a part is rendered (absent: React renders nothing inside). */
const SELECT_CONTENT = new InjectionToken<Signal<boolean>>("rind-ui.select-content")

/** The popup: `<div rindSelectContent>`, holding the List. */
@Directive({
  selector: "[rindSelectContent]",
  exportAs: "rindSelectContent",
  providers: [
    { provide: SELECT_CONTENT, useFactory: () => inject(forwardRef(() => SelectContent)).present },
    {
      provide: LAYER,
      useFactory: () => {
        const root = injectSelect("Content")
        return layerProvider(
          () => selectLayerId(root.instance()),
          () => "listbox",
        )
      },
    },
  ],
})
export class SelectContent {
  /** @internal */
  readonly present: Signal<boolean>
  constructor() {
    const root = injectSelect("Content")
    const el: Element = inject(ElementRef).nativeElement
    const open = () => root.view().matches("open")
    const presence = injectPresence(open, el, { keepMounted: () => root.keepMounted() })
    this.present = presence.mounted
    bindProps(() => {
      if (!presence.mounted()) return absentProps("select", root.instance())
      const exiting = !open() && presence.state() === "exiting"
      return {
        ...root.api().content(),
        hidden: !open() && !exiting && root.keepMounted(),
        ...(exiting ? { inert: "" } : {}),
      }
    })
  }
}

/**
 * The options: `<div rindSelectList>` with `rindSelectItem`s (or the data `groups()`), named as
 * the trigger is.
 */
@Directive({
  selector: "[rindSelectList]",
  exportAs: "rindSelectList",
  hostDirectives: [ListboxList],
  providers: [
    {
      provide: LISTBOX_HOST,
      useFactory: (): ListboxHost => {
        const root = injectSelect("List")
        const env = injectEnvironment()
        // A Field's label names the list when the select renders no label of its own.
        const fieldLabel = injectFieldBindingPeek()
        const listFocused = signal(false)
        const modality = injectModality(env.modality, listFocused)
        const parts = computed(() => {
          const a = root.api({ listFocused: listFocused(), modality: modality() })
          return {
            ...a.listbox,
            list: (): PartProps => ({
              ...a.list({
                ...root.triggerNaming,
                labelledBy: root.triggerNaming.labelledBy ?? fieldLabel?.().ids.label,
              }),
              onFocus: () => listFocused.set(true),
              onBlur: () => listFocused.set(false),
            }),
          }
        })
        return {
          name: "Select",
          // Sound: the select's listbox parts are the Listbox's, with its own list.
          parts: () => parts() as unknown as ReturnType<ListboxHost["parts"]>,
          collection: () => root.collectionNow(),
          registry: () => root.registry(),
          mount: (p, on) => root.setMounted(p, on),
          mountDescription: (key, on) => root.mountDescription(key, on),
          requestLoadMore: () => {},
          instance: () => root.instance(),
        }
      },
    },
  ],
})
export class SelectList {
  constructor() {
    // The list registers itself (aria-controls exists only while it is rendered): while its
    // Content is, after the first render.
    const root = injectSelect("List")
    const present = inject(SELECT_CONTENT, { optional: true })
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = injectRendered()
    effect(() => {
      const on = ready() && (present?.() ?? true)
      untracked(() => root.setMounted("list", on))
    })
    inject(DestroyRef).onDestroy(() => root.setMounted("list", false))
  }
}

/**
 * The select's portal (`<ng-template rindSelectPortal>`), with the trigger as its logical
 * parent: the host carries its theme, dir and lang.
 */
@Directive({
  selector: "ng-template[rindSelectPortal]",
  exportAs: "rindSelectPortal",
  providers: PORTAL_PROVIDERS,
})
export class SelectPortal extends PortalBase {
  private readonly owner = injectSelect("Portal")
  protected parent(): Element | null {
    return this.owner.trigger()
  }
}

/** The Select's parts (its options are the Listbox's, `rindSelectItem` and the rest). */
export const Select = [
  SelectRoot,
  SelectLabel,
  SelectTrigger,
  SelectValueText,
  SelectIndicator,
  SelectDescription,
  SelectPositioner,
  SelectContent,
  SelectList,
  SelectPortal,
  ListboxItem,
  ListboxItemText,
  ListboxItemDescription,
  ListboxItemIndicator,
  ListboxSection,
  ListboxSeparator,
  ListboxEmpty,
  ListboxLoadMore,
] as const
