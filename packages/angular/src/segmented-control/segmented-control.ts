import {
  afterEveryRender,
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
  ViewContainerRef,
} from "@angular/core"
import {
  announcerCapability,
  type ChangeDetails,
  createListCollection,
  hiddenFormInput,
  implicitSubmit,
  isImeKey,
  layoutCapability,
  type RadioGroupEvent,
  radioGroupMachine,
  segmentedControlConnect,
  segmentedControlIds,
  toKey,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { bindProps, joinHandlers } from "../bind-props"
import { declaredStop, injectCollectionItems, injectRegisterItem } from "../collection-items"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectFieldsetDisabled } from "../fieldset/context"
import { HiddenInput } from "../hidden-input"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectEnvironment } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { injectSelectionIndicator } from "../selection-indicator"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

export interface SegmentedControlState {
  readonly value: string | null
  readonly disabled: boolean
}
export interface SegmentState {
  readonly checked: boolean
  readonly disabled: boolean
}

const CONTROL = new InjectionToken<SegmentedControlRoot>("rind-ui.segmented-control")

function injectControl(part: string): SegmentedControlRoot {
  const root = inject(CONTROL, { optional: true })
  if (!root) throw new Error(`rindSegmentedControl${part} must be inside rindSegmentedControlRoot`)
  return root
}

/**
 * A single choice shown as joined buttons (a radiogroup): `<div rindSegmentedControlRoot
 * aria-label="Range" [(value)]="range">` with `<button rindSegmentedControlItem value="day">`
 * segments and an optional sliding Indicator.
 */
@Directive({
  selector: "[rindSegmentedControlRoot]",
  exportAs: "rindSegmentedControlRoot",
  providers: [{ provide: CONTROL, useExisting: forwardRef(() => SegmentedControlRoot) }],
})
export class SegmentedControlRoot {
  /** Controlled value (`[(value)]`). */
  readonly value = input<string | null>()
  readonly defaultValue = input<string | null>()
  /** `aria-orientation`, `data-orientation` and the indicator only: every arrow key moves. */
  readonly orientation = input<"horizontal" | "vertical">("horizontal")
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly focusableWhenDisabled = input(false, { transform: booleanAttribute })
  readonly readonly = input(false, { transform: booleanAttribute })
  readonly required = input(false, { transform: booleanAttribute })
  readonly invalid = input(false, { transform: booleanAttribute })
  /** Default: derived from the root id. */
  readonly name = input<string>()
  readonly form = input<string>()
  readonly id = input<string>()
  /** Every change proposes a new value; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<ChangeEvent<string | null, RadioGroupEvent>>()
  /** The accepted value, for `[(value)]`. */
  readonly valueChange = output<string | null>()

  private readonly emit = changeEmitter<string | null, RadioGroupEvent>(
    this.valueChangeDetails,
    this.valueChange,
  )
  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly api: (pendingStop?: string | null) => ReturnType<typeof segmentedControlConnect>
  /** @internal */
  readonly send: (event: RadioGroupEvent) => void
  /** @internal */
  readonly registry: ReturnType<typeof injectCollectionItems>["registry"]
  /** @internal */
  readonly collection: () => unknown
  /** @internal */
  readonly parts: () => PartRegistry<"label">
  /** @internal */
  readonly ids: () => ReturnType<typeof segmentedControlIds>
  /** @internal */
  readonly current: () => string | null
  /** @internal */
  readonly groupDisabled: () => boolean
  /** @internal A user change waiting for its commit: that segment's input dispatches it. */
  readonly pending: { current: string | null } = { current: null }
  /** @internal */
  readonly stop = declaredStop()
  /** The control's state, for the template (`#s="rindSegmentedControlRoot"`, `s.state()`). */
  readonly state: Signal<SegmentedControlState>

  constructor() {
    const env = injectEnvironment(announcerCapability, layoutCapability)
    const instance = this.instance
    const ids = computed(() => segmentedControlIds(instance()))
    this.ids = ids
    const fieldsetContext = injectFieldsetDisabled()
    const fieldsetDom = signal(false)
    const groupDisabled = () => this.disabled() || fieldsetContext() || fieldsetDom()
    this.groupDisabled = groupDisabled
    const { collection: registered, registry } = injectCollectionItems()
    this.registry = registry
    this.collection = registered
    const collection = () => registered() ?? EMPTY
    const pending = this.pending
    const { view, send } = injectMachine(
      radioGroupMachine,
      () => ({
        collection: collection(),
        strategy: "roving" as const,
        ids: ids(),
        loop: true,
        selectionMode: "single" as const,
        focusableWhenDisabled: this.focusableWhenDisabled(),
        value: this.value(),
        defaultValue: this.defaultValue(),
        // A user change (an arrow or a press) is dispatched on that segment's input after render.
        onValueChange: (next: string | null, details: ChangeDetails<RadioGroupEvent>) => {
          if (details.reason === "NAVIGATE" || details.reason === "PRESS") pending.current = next
          this.emit(next, details)
        },
        disabled: groupDisabled(),
        readOnly: this.readonly(),
      }),
      env,
    )
    this.send = send
    const current = () => view().values.value ?? null
    this.current = current
    const ariaLabel = inject(new HostAttributeToken("aria-label"), { optional: true }) ?? undefined
    // The Label is expected unless aria-label names the control: the server HTML then already
    // labels the root (base-ui#5597).
    this.parts = injectPartRegistry<"label">(() => ({
      scope: "segmented-control",
      root: instance(),
      ...(ariaLabel === undefined ? { expected: ["label"] as const } : {}),
    }))
    const labelRendered = injectRenderedId(this.parts, "label")
    this.api = (pendingStop: string | null = null) =>
      segmentedControlConnect(
        {
          instance: instance(),
          collection: collection(),
          value: current(),
          highlightedKey: view().context.highlightedKey,
          highlightSource: view().context.highlightSource,
          pending: registered() === null,
          pendingStop,
          orientation: this.orientation(),
          disabled: groupDisabled(),
          focusableWhenDisabled: this.focusableWhenDisabled(),
          readOnly: this.readonly(),
          required: this.required(),
          invalid: this.invalid(),
          name: this.name(),
          form: this.form(),
          labelRendered: labelRendered(),
          ariaLabel,
          indicator: view().context.indicator,
        },
        send,
        env,
      )
    this.state = computed(() => ({ value: current(), disabled: groupDisabled() }))
    bindProps(() => this.api().root(), {
      owns: [
        "defaultvalue",
        "disabled",
        "focusablewhendisabled",
        "form",
        "id",
        "invalid",
        "name",
        "orientation",
        "readonly",
        "required",
        "value",
      ],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const el: Element = inject(ElementRef).nativeElement
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      const w = watchFieldsetDisabled(el, (d) => fieldsetDom.set(d))
      fieldsetDom.set(w.disabled)
      // A form reset is answered once, by the control (every segment's input re-syncs).
      const doc = el.ownerDocument
      const onReset = (e: Event) => {
        if (e.defaultPrevented) return
        const control = el.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
        if (control && e.target === control.form) send({ type: "RESET" })
      }
      doc.addEventListener("reset", onReset)
      destroy.onDestroy(() => {
        w.stop()
        doc.removeEventListener("reset", onReset)
      })
    })
    let warned = false
    afterEveryRender(() => {
      // After the segments' updates: a proposal the parent refused never dispatches later.
      if (pending.current !== null && pending.current !== current()) pending.current = null
      // Development: a radiogroup needs a name (Label, aria-label or aria-labelledby).
      if (process.env.NODE_ENV === "production" || warned) return
      if (!el.getAttribute("aria-labelledby") && !el.getAttribute("aria-label")) {
        warned = true
        console.warn(
          `[rind-ui] segmented-control: #${el.id} has no accessible name; render rindSegmentedControlLabel or pass aria-label`,
        )
      }
    })
  }
}

/** Not a `<label>`: a radiogroup is not labelable. */
@Directive({ selector: "[rindSegmentedControlLabel]", exportAs: "rindSegmentedControlLabel" })
export class SegmentedControlLabel {
  constructor() {
    const root = injectControl("Label")
    injectRegisterPart(root.parts, "label", () => root.ids().label)
    bindProps(() => root.api().label())
  }
}

/**
 * A segment: `<button rindSegmentedControlItem value="day">Day</button>`; its hidden input is
 * the button's next sibling (never inside it: reka-ui#1597).
 */
@Directive({ selector: "[rindSegmentedControlItem]", exportAs: "rindSegmentedControlItem" })
export class SegmentedControlItem {
  /** The segment's value: what the control's value and the form submit. */
  readonly value = input.required<string>()
  /** Disables this segment: it cannot be checked. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** The text for the collection (defaults to the segment's text content). */
  readonly textValue = input<string>()
  /** The segment's state, for the template (`#i="rindSegmentedControlItem"`, `i.state()`). */
  readonly state: Signal<SegmentState>

  constructor() {
    const root = injectControl("Item")
    const env = injectEnvironment()
    const el: HTMLElement = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    const key = () => toKey(this.value())
    injectRegisterItem(
      root.registry,
      () => ({ key: this.value(), textValue: this.textValue(), disabled: this.disabled() }),
      el,
    )
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const isDisabled = () => root.groupDisabled() || this.disabled()
    const press = injectPress({
      env,
      send: (e) => {
        if (e.type === "PRESS") root.send({ type: "PRESS", key: key(), modality: e.modality })
      },
      disabled: isDisabled,
    })
    const hover = injectHover({ env, send: () => {}, disabled: isDisabled })
    const checked = () => root.current() === key()
    this.state = computed(() => ({ checked: checked(), disabled: isDisabled() }))
    const pendingStop = () =>
      root.stop(
        this.value(),
        isDisabled(),
        root.current() === null ? [] : [root.current() as string],
      )
    // The hidden input: the next sibling, in this directive's view container (hydration knows it).
    const hidden = inject(ViewContainerRef).createComponent(HiddenInput)
    effect(() => {
      const props = root.api().hiddenInput(key(), { disabled: this.disabled() })
      untracked(() => hidden.setInput("props", props))
    })
    bindProps(
      () =>
        joinHandlers(
          root.api(pendingStop()).item(key(), {
            tag,
            focused: focused(),
            modality: modality(),
            pressed: press.pressed(),
            hovered: hover.hovered(),
            itemDisabled: this.disabled(),
          }),
          {
            // Enter submits the form (implicit submission); it never selects.
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
              implicitSubmit(inputEl()?.form ?? null)
            },
          },
          press.props,
          hover.props,
          { onFocusIn: () => focused.set(true), onFocusOut: () => focused.set(false) },
        ),
      { owns: ["disabled", "textvalue", "value"] },
    )
    const inputEl = () => hidden.location.nativeElement as HTMLInputElement | null
    if (inject(PLATFORM_ID) !== "browser") return
    const formInput = hiddenFormInput({ input: inputEl, control: () => el }, env)
    // After every render: the input mirrors the value; the newly checked one, after a user
    // change, dispatches input + change (programmatic changes stay silent).
    let named = false
    afterEveryRender(() => {
      const dispatch = checked() && root.pending.current === key()
      formInput.sync({ checked: checked() }, { dispatch })
      if (dispatch) root.pending.current = null
      // Development: a segment needs a name (text content or aria-label).
      if (process.env.NODE_ENV === "production" || named) return
      named =
        (el.textContent ?? "").trim() !== "" ||
        el.getAttribute("aria-label") !== null ||
        el.getAttribute("aria-labelledby") !== null
      if (!named) {
        named = true
        console.warn(
          `[rind-ui] segmented-control: the item "${this.value()}" has no text and no aria-label; an icon-only segment needs aria-label`,
        )
      }
    })
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      // The modality tracker must see the pointerdown that comes before focus.
      destroy.onDestroy(env.modality.subscribe(() => {}))
      destroy.onDestroy(
        formInput.track({
          onReset: () => {},
          current: () => ({ checked: checked() }),
          // The control answers the reset once; each input only re-syncs.
          resetsWithForm: false,
        }),
      )
    })
  }
}

/** Slides under the checked segment (`--rind-indicator-*`); hidden while nothing is checked. */
@Directive({
  selector: "[rindSegmentedControlIndicator]",
  exportAs: "rindSegmentedControlIndicator",
})
export class SegmentedControlIndicator {
  constructor() {
    const root = injectControl("Indicator")
    injectSelectionIndicator({
      selectedId: () => {
        const value = root.current()
        return value === null ? null : root.ids().item(toKey(value))
      },
      itemSelector: () => `[data-part="item"][data-instance="${root.instance()}"]`,
      collection: root.collection,
      onMeasure: (box, cause) => root.send({ type: "INDICATOR.MEASURE", box, cause }),
    })
    bindProps(() => root.api().indicator())
  }
}

/** The Segmented Control's parts, for a standalone component's `imports`. */
export const SegmentedControl = [
  SegmentedControlRoot,
  SegmentedControlLabel,
  SegmentedControlItem,
  SegmentedControlIndicator,
] as const
