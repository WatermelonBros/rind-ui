import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
} from "@angular/core"
import {
  announcerCapability,
  type CollectionKey,
  createListCollection,
  layoutCapability,
  type ToggleGroupEvent,
  toggleGroupConnect,
  toggleGroupIds,
  toggleGroupMachine,
  toKey,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { declaredStop, injectCollectionItems, injectRegisterItem } from "../collection-items"
import { injectCompositeHost, injectHostItem } from "../composite-host"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectEnvironment } from "../provider"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

/** Enough state to read an item's id (the key the host knows it by). */
const NO_STATE = {
  tag: "button",
  itemDisabled: false,
  focused: false,
  modality: "keyboard",
  pressed: false,
  hovered: false,
} as const

export interface ToggleGroupState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

export interface ToggleGroupItemState {
  readonly pressed: boolean
  readonly disabled: boolean
}

/** `undefined` stays undefined (the host's or the default); a bare attribute is `true`. */
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

const GROUP = new InjectionToken<ToggleGroupRoot>("rind-ui.toggle-group")
const ITEM = new InjectionToken<ToggleGroupItem>("rind-ui.toggle-group-item")

/**
 * A set of toggles with one roving tab stop: `<div rindToggleGroupRoot aria-label="Alignment"
 * [(value)]="align">` holding `<button rindToggleGroupItem value="left">` items.
 */
@Directive({
  selector: "[rindToggleGroupRoot]",
  exportAs: "rindToggleGroupRoot",
  providers: [{ provide: GROUP, useExisting: forwardRef(() => ToggleGroupRoot) }],
})
export class ToggleGroupRoot {
  /** Controlled value (`[(value)]`). */
  readonly value = input<readonly string[]>()
  readonly defaultValue = input<readonly string[]>()
  /** Default `single`: pressing an item replaces the selection. */
  readonly selectionMode = input<"single" | "multiple">("single")
  /** The last pressed item cannot be released. */
  readonly disallowEmptySelection = input(false, { transform: booleanAttribute })
  readonly orientation = input<"horizontal" | "vertical">("horizontal")
  /** Arrow moves wrap at both ends (default true). */
  readonly loop = input(true, { transform: booleanAttribute })
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly focusableWhenDisabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly id = input<string>()
  /** Every press proposes a new value; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<ChangeEvent<readonly string[], ToggleGroupEvent>>()
  /** The accepted value, for `[(value)]`. */
  readonly valueChange = output<readonly string[]>()

  private readonly emit = changeEmitter<readonly string[], ToggleGroupEvent>(
    this.valueChangeDetails,
    this.valueChange,
  )
  /** @internal */
  readonly registry: ReturnType<typeof injectCollectionItems>["registry"]
  /** @internal The connect output; `pendingStop` for an item still unregistered. */
  readonly api: (pendingStop?: string | null) => ReturnType<typeof toggleGroupConnect>
  /** @internal */
  readonly send: (event: ToggleGroupEvent) => void
  /** @internal */
  readonly current: () => readonly string[]
  /** @internal */
  readonly groupDisabled: () => boolean
  /** @internal */
  readonly hostFocusableWhenDisabled: () => boolean
  /** @internal */
  readonly stop = declaredStop()
  /** The group's state, for the template (`#g="rindToggleGroupRoot"`, `g.state()`). */
  readonly state: () => ToggleGroupState

  constructor() {
    const env = injectEnvironment(announcerCapability, layoutCapability)
    // Hosted by a Toolbar: its disabled state applies, its focusableWhenDisabled unless ours.
    const host = injectCompositeHost()
    const focusableWhenDisabled = () =>
      this.focusableWhenDisabled() ?? host?.focusableWhenDisabled ?? false
    this.hostFocusableWhenDisabled = focusableWhenDisabled
    const instance = injectRootId(() => this.id())
    const ids = computed(() => toggleGroupIds(instance()))
    const fieldsetDisabled = injectFieldsetDisabled()
    const groupDisabled = () => this.disabled() || fieldsetDisabled() || host?.disabled === true
    this.groupDisabled = groupDisabled
    const { collection: registered, registry } = injectCollectionItems()
    this.registry = registry
    const collection = () => registered() ?? EMPTY
    const { view, send } = injectMachine(
      toggleGroupMachine,
      () => ({
        collection: collection(),
        strategy: "roving" as const,
        ids: ids(),
        loop: this.loop(),
        selectionMode: this.selectionMode(),
        disallowEmptySelection: this.disallowEmptySelection(),
        focusableWhenDisabled: focusableWhenDisabled(),
        value: this.value(),
        defaultValue: this.defaultValue(),
        onValueChange: this.emit,
        disabled: groupDisabled(),
      }),
      env,
    )
    this.send = send
    const current = () => view().values.value ?? []
    this.current = current
    this.api = (pendingStop: string | null = null) =>
      toggleGroupConnect(
        {
          instance: instance(),
          collection: collection(),
          value: current(),
          highlightedKey: view().context.highlightedKey,
          pending: registered() === null,
          pendingStop,
          orientation: this.orientation(),
          selectionMode: this.selectionMode(),
          disabled: groupDisabled(),
          focusableWhenDisabled: focusableWhenDisabled(),
          focusWithin: view().matches("focused"),
          hosted: host !== null,
        },
        send,
        env,
      )
    this.state = computed(() => ({ value: current(), disabled: groupDisabled() }))
    bindProps(() => this.api().root(), {
      owns: [
        "defaultvalue",
        "disabled",
        "disallowemptyselection",
        "focusablewhendisabled",
        "id",
        "loop",
        "orientation",
        "selectionmode",
        "value",
      ],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // Development: a group needs a name (aria-label or aria-labelledby: radix#754).
    const el: Element = inject(ElementRef).nativeElement
    afterRenderEffect(() => {
      if (process.env.NODE_ENV === "production") return
      if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
        console.warn(
          `[rind-ui] toggle-group: the root #${el.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    })
  }
}

/**
 * An item of the group (`value` is its key). Outside a group use `rindToggleRoot`: a directive
 * cannot turn into another one, so a lone item has no Toggle fallback (React's has).
 */
@Directive({
  selector: "[rindToggleGroupItem]",
  exportAs: "rindToggleGroupItem",
  providers: [{ provide: ITEM, useExisting: forwardRef(() => ToggleGroupItem) }],
})
export class ToggleGroupItem {
  /** The item's key in the group's value. */
  readonly value = input.required<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly textValue = input<string>()

  /** @internal */
  readonly group: ToggleGroupRoot
  /** @internal */
  readonly key = (): CollectionKey => toKey(this.value())
  /** @internal This item's view of the server tab stop, read once (document order). */
  readonly pendingStop: () => string | null
  /** The item's state, for the template (`#i="rindToggleGroupItem"`, `i.state()`). */
  readonly state: () => ToggleGroupItemState

  constructor() {
    const group = inject(GROUP, { optional: true })
    if (!group) {
      throw new Error(
        "rindToggleGroupItem must be inside rindToggleGroupRoot; a lone toggle is rindToggleRoot",
      )
    }
    this.group = group
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    injectRegisterItem(
      group.registry,
      () => ({ key: this.value(), textValue: this.textValue(), disabled: this.disabled() }),
      el,
    )
    this.pendingStop = () =>
      group.stop(this.value(), group.groupDisabled() || this.disabled(), group.current())
    // Hosted: the item is also one of the host's controls (navigation and tab stop).
    const host = injectCompositeHost()
    const hostKey = () => group.api().item(this.key(), NO_STATE)["id"] as string // set by the connect
    const itemDisabled = () => group.groupDisabled() || this.disabled()
    injectHostItem(
      host,
      () => ({
        id: hostKey(),
        skip: itemDisabled() && !group.hostFocusableWhenDisabled(),
        textValue: this.textValue(),
      }),
      el,
    )
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const press = injectPress({
      env,
      send: (e) => {
        if (e.type === "PRESS") group.send({ type: "PRESS", key: this.key(), modality: e.modality })
      },
      disabled: itemDisabled,
    })
    const hover = injectHover({ env, send: () => {}, disabled: itemDisabled })
    this.state = computed(() => ({
      pressed: group.current().includes(this.key()),
      disabled: itemDisabled(),
    }))
    bindProps(
      () => {
        const hostProps = host
          ? host.itemProps({
              id: hostKey(),
              disabled: itemDisabled(),
              first: host.claimFirst(hostKey()),
            })
          : {}
        const own = group.api(this.pendingStop()).item(this.key(), {
          tag,
          itemDisabled: this.disabled(),
          focused: focused(),
          modality: modality(),
          pressed: press.pressed(),
          hovered: hover.hovered(),
        })
        return joinHandlers(own, hostProps, press.props, hover.props, {
          onFocusIn: () => focused.set(true),
          onFocusOut: () => focused.set(false),
        })
      },
      { owns: ["disabled", "textvalue", "value"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // The modality tracker must see the pointerdown that comes before focus.
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
}

/** Decorative: follows its item's pressed state. Show content with `@if (i.state().pressed)`. */
@Directive({ selector: "[rindToggleGroupItemIndicator]", exportAs: "rindToggleGroupItemIndicator" })
export class ToggleGroupItemIndicator {
  constructor() {
    const item = inject(ITEM, { optional: true })
    if (!item) throw new Error("rindToggleGroupItemIndicator must be inside rindToggleGroupItem")
    bindProps(() =>
      item.group
        .api(item.pendingStop())
        .itemIndicator(item.key(), { itemDisabled: item.disabled() }),
    )
  }
}

/** The Toggle Group's parts, for a standalone component's `imports`. */
export const ToggleGroup = [ToggleGroupRoot, ToggleGroupItem, ToggleGroupItemIndicator] as const
