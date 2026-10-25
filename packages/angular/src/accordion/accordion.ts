import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  untracked,
} from "@angular/core"
import {
  type AccordionEvent,
  type AccordionItemState,
  accordionConnect,
  accordionMachine,
  type ChangeDetails,
  type ClosedContent,
  type CollapsibleEvent,
  type PartProps as CorePartProps,
  describeKey,
  focusSafely,
  type HeadingLevel,
  type ItemKey,
  itemKey,
  openKeysOf,
  resolveHeadingLevel,
  type TriggerKeyEvent,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import {
  COLLAPSIBLE,
  CollapsibleContent,
  type CollapsibleCtx,
  type CollapsibleDecoration,
  CollapsibleIndicator,
  type CollapsibleState,
  CollapsibleTrigger,
  injectCollapsibleService,
} from "../collapsible/collapsible"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { HEADING_LEVEL } from "../heading/heading"
import { injectRootId, RindIds } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectEnvironment, injectLocale } from "../provider"

declare const process: { env: { NODE_ENV?: string } }

/** The default header level outside any `rindHeadingLevel` (spec "Heading Structure"). */
const DEFAULT_HEADER_LEVEL = 3

export interface AccordionState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

const ACCORDION = new InjectionToken<AccordionRoot>("rind-ui.accordion")
const ITEM = new InjectionToken<AccordionItem>("rind-ui.accordion-item")

function injectAccordion(part: string): AccordionRoot {
  const root = inject(ACCORDION, { optional: true })
  if (!root) throw new Error(`rindAccordion${part} must be inside rindAccordionRoot`)
  return root
}

/**
 * Stacked disclosures: `<div rindAccordionRoot>` with `rindAccordionItem` items, each a Header
 * (`<h3 rindAccordionHeader>`) holding the Trigger, and the Content.
 */
@Directive({
  selector: "[rindAccordionRoot]",
  exportAs: "rindAccordionRoot",
  providers: [{ provide: ACCORDION, useExisting: forwardRef(() => AccordionRoot) }],
})
export class AccordionRoot {
  /** Controlled open items (`[(value)]`). */
  readonly value = input<readonly string[]>()
  readonly defaultValue = input<readonly string[]>()
  /** Several items open at once. */
  readonly multiple = input(false, { transform: booleanAttribute })
  /** Single mode: the open item can be closed (default true). Ignored when `multiple`. */
  readonly collapsible = input(true, { transform: booleanAttribute })
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Disabled triggers stay focusable (`aria-disabled`). */
  readonly focusableWhenDisabled = input(false, { transform: booleanAttribute })
  /** Arrow keys, Home and End move between triggers (off by default, as in APG 2026). */
  readonly keyboardNavigation = input(false, { transform: booleanAttribute })
  readonly orientation = input<"vertical" | "horizontal">("vertical")
  readonly dir = input<"ltr" | "rtl">()
  /** The headers' level; default: the surrounding `rindHeadingLevel`'s, else 3. */
  readonly headingLevel = input<HeadingLevel>()
  /** What closed content becomes; an item can override it. */
  readonly closedContent = input<ClosedContent>("until-found")
  /** Overrides the region rule for open panels. */
  readonly contentRole = input<"region" | "none">()
  readonly id = input<string>()
  /** Every activation proposes the open items; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<ChangeEvent<readonly string[], AccordionEvent>>()
  /** The accepted open items, for `[(value)]`. */
  readonly valueChange = output<readonly string[]>()

  private readonly emit = changeEmitter<readonly string[], AccordionEvent>(
    this.valueChangeDetails,
    this.valueChange,
  )
  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly triggers = new Map<ItemKey, { value: Element | null }>()
  /** @internal */
  readonly send: (event: AccordionEvent) => void
  /** @internal */
  readonly openKeys: Signal<readonly string[]>
  /** @internal */
  readonly api: Signal<ReturnType<typeof accordionConnect>>
  /** @internal */
  readonly level: Signal<HeadingLevel>
  /** The accordion's state, for the template (`#a="rindAccordionRoot"`, `a.state()`). */
  readonly state: Signal<AccordionState>

  constructor() {
    const env = injectEnvironment()
    const locale = injectLocale(
      () => undefined,
      () => this.dir(),
    )
    const triggers = this.triggers
    const { view, send } = injectMachine(accordionMachine, () => ({
      value: this.value(),
      defaultValue: this.defaultValue(),
      onValueChange: this.emit,
      multiple: this.multiple(),
      collapsible: this.collapsible(),
      disabled: this.disabled(),
      keyboardNavigation: this.keyboardNavigation(),
      // Document order of the triggers, whatever the creation order or closed-content mode.
      triggerOrder: (items: readonly ItemKey[]) =>
        [...items].sort((a, b) => {
          const x = triggers.get(a)?.value
          const y = triggers.get(b)?.value
          if (!x || !y) return 0
          return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        }),
      focusTrigger: (item: ItemKey) => {
        const el = triggers.get(item)?.value
        if (el instanceof HTMLElement) void focusSafely(el, env)
      },
    }))
    this.send = send
    const context = inject(HEADING_LEVEL, { optional: true })
    this.level = computed(() =>
      resolveHeadingLevel(this.headingLevel(), context?.() ?? DEFAULT_HEADER_LEVEL),
    )
    this.openKeys = computed(() => openKeysOf(view().values.value ?? [], this.multiple()))
    this.api = computed(() =>
      accordionConnect(
        {
          instance: this.instance(),
          orientation: this.orientation(),
          dir: locale().dir,
          platform: env.platform,
          disabled: this.disabled(),
          multiple: this.multiple(),
          collapsible: this.collapsible(),
          keyboardNavigation: this.keyboardNavigation(),
          itemCount: view().context.items.size,
          contentRole: this.contentRole(),
        },
        send,
      ),
    )
    this.state = computed(() => ({ value: this.openKeys(), disabled: this.disabled() }))
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "closedcontent",
          "collapsible",
          "contentrole",
          "defaultvalue",
          "dir",
          "disabled",
          "focusablewhendisabled",
          "headinglevel",
          "id",
          "keyboardnavigation",
          "multiple",
          "orientation",
          "value",
        ],
      },
    )
  }
}

/** Collapsible's TOGGLE / OPEN / CLOSE proposals become the accordion's item events. */
function itemEvent(item: ItemKey, event: CollapsibleEvent): AccordionEvent {
  switch (event.type) {
    case "TOGGLE":
      return { type: "ITEM.TOGGLE", item, modality: event.modality }
    case "OPEN":
      return { type: "ITEM.OPEN", item, reason: event.reason }
    case "CLOSE":
      return { type: "ITEM.CLOSE", item, reason: event.reason }
    default: {
      const never: never = event
      return never
    }
  }
}

/** One disclosure: `<div rindAccordionItem value="shipping">`. */
@Directive({
  selector: "[rindAccordionItem]",
  exportAs: "rindAccordionItem",
  providers: [
    { provide: ITEM, useExisting: forwardRef(() => AccordionItem) },
    { provide: COLLAPSIBLE, useFactory: () => inject(forwardRef(() => AccordionItem)).ctx },
  ],
})
export class AccordionItem {
  /** A non-empty string, unique within the accordion. */
  readonly value = input.required<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly closedContent = input<ClosedContent>()

  /** @internal */
  readonly ctx: CollapsibleCtx
  /** @internal */
  readonly itemState: () => AccordionItemState
  /** The item's state, for the template (`#i="rindAccordionItem"`, `i.state()`). */
  readonly state: Signal<CollapsibleState>

  constructor() {
    const root = injectAccordion("Item")
    const env = injectEnvironment()
    const key = () => itemKey(this.value())
    const disabled = () => this.disabled() || root.disabled()
    const open = () => root.openKeys().includes(key())
    const generated = `accordion-item-${inject(RindIds).next()}`
    const state = (): AccordionItemState => ({ item: key(), open: open(), disabled: disabled() })
    this.itemState = state
    this.state = computed(() => ({ open: open(), disabled: disabled() }))
    const decoration: CollapsibleDecoration = {
      trigger: () => {
        const t = root.api().trigger(state())
        const onKeyDown = t["onKeyDown"] as (e: TriggerKeyEvent) => void // set by connect
        return {
          ...t,
          onKeyDown: (e: KeyboardEvent) =>
            onKeyDown({
              ...describeKey(e, env),
              onTrigger: e.target === e.currentTarget,
              preventDefault: () => e.preventDefault(),
            }),
        } satisfies CorePartProps
      },
      content: (triggerId) => root.api().content(state(), triggerId),
      indicator: () => root.api().indicator(),
      // A heading inside a panel is one level below its header.
      contentLevel: () => Math.min(root.level() + 1, 6),
    }
    const ctx = injectCollapsibleService({
      scope: "accordion",
      instance: root.instance,
      idBase: () => generated,
      decoration,
      props: () => ({
        open: open(),
        defaultOpen: undefined,
        // A proposal is always one of the collapsible's own events (never a system event).
        onOpenChange: (_open: boolean, details: ChangeDetails<CollapsibleEvent>) =>
          root.send(itemEvent(key(), details.event as CollapsibleEvent)),
        disabled: disabled(),
        focusableWhenDisabled: root.focusableWhenDisabled(),
        closedContent: this.closedContent() ?? root.closedContent(),
      }),
    })
    this.ctx = ctx
    bindProps(() => root.api().item(state()), { owns: ["closedcontent", "disabled", "value"] })
    if (inject(PLATFORM_ID) !== "browser") return
    // Registered after the first render and whenever its key or flags change.
    let registered: ItemKey | undefined
    let ready = false
    const register = () => {
      const item = key()
      const isDisabled = disabled()
      const focusable = !isDisabled || root.focusableWhenDisabled()
      if (registered !== undefined && registered !== item) {
        root.send({ type: "ITEM.UNREGISTER", item: registered })
        root.triggers.delete(registered)
      }
      registered = item
      root.triggers.set(item, ctx.triggerEl)
      root.send({ type: "ITEM.REGISTER", item, disabled: isDisabled, focusable })
    }
    afterNextRender(() => {
      ready = true
      untracked(register)
    })
    effect(() => {
      key()
      disabled()
      root.focusableWhenDisabled()
      if (ready) untracked(register)
    })
    inject(DestroyRef).onDestroy(() => {
      if (registered === undefined) return
      root.send({ type: "ITEM.UNREGISTER", item: registered })
      root.triggers.delete(registered)
    })
  }
}

/**
 * The item's header: a heading element holding only the Trigger (`<h3 rindAccordionHeader>`).
 * The element is yours: on another heading element it carries `aria-level` (the accordion's
 * `headingLevel`, else the surrounding level, else 3); `#a="rindAccordionRoot"` gives
 * `a.level()` to pick the element.
 */
@Directive({ selector: "[rindAccordionHeader]", exportAs: "rindAccordionHeader" })
export class AccordionHeader {
  constructor() {
    const root = injectAccordion("Header")
    const item = inject(ITEM, { optional: true })
    if (!item) throw new Error("rindAccordionHeader must be inside rindAccordionItem")
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    bindProps(() => root.api().header(item.itemState(), root.level(), tag))
    if (inject(PLATFORM_ID) !== "browser") return
    // APG: the button is the heading's only element (base-ui#3632).
    let warned = false
    afterRenderEffect(() => {
      if (process.env.NODE_ENV === "production" || warned) return
      const others = Array.from(el.children).filter(
        (c) => c.getAttribute("data-part") !== "trigger",
      )
      if (others.length > 0) {
        warned = true
        console.warn(
          `[rind-ui] accordion: the header of item "${item.itemState().item}" contains elements besides its trigger; the trigger must be the heading's only element`,
        )
      }
    })
  }
}

/** The Accordion's parts (its Trigger, Content and Indicator are the Collapsible's), for `imports`. */
export const Accordion = [
  AccordionRoot,
  AccordionItem,
  AccordionHeader,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleIndicator,
] as const
export {
  CollapsibleContent as AccordionContent,
  CollapsibleIndicator as AccordionIndicator,
  CollapsibleTrigger as AccordionTrigger,
}
