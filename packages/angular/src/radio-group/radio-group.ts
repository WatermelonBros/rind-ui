import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
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
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  announcerCapability,
  type ChangeDetails,
  type CollectionKey,
  createListCollection,
  focusSafely,
  hiddenFormInput,
  implicitSubmit,
  isImeKey,
  layoutCapability,
  mergeFieldProps,
  type PartProps,
  type RadioGroupEvent,
  type RadioNaming,
  radioGroupConnect,
  radioGroupIds,
  radioGroupMachine,
  radioPartName,
  toKey,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { declaredStop, injectCollectionItems, injectRegisterItem } from "../collection-items"
import { injectCompositeHost, injectHostItem } from "../composite-host"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectFieldControl } from "../field/context"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectEnvironment } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { RindProps } from "../rind-props"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

type GroupPart = "label" | "description" | "error-message"

export interface RadioGroupState {
  readonly value: string | null
  readonly disabled: boolean
}
export interface RadioItemState {
  readonly checked: boolean
  readonly disabled: boolean
}

/**
 * Internal (not exported from the package): set by a component that renders a Radio Group as
 * its part (Color Picker's swatch group): the host's scope and part names.
 */
export const RADIO_NAMING = new InjectionToken<RadioNaming>("rind-ui.radio-naming")

const GROUP = new InjectionToken<RadioGroupRoot>("rind-ui.radio-group")
const ITEM = new InjectionToken<RadioGroupItem>("rind-ui.radio-item")

function injectGroup(part: string): RadioGroupRoot {
  const root = inject(GROUP, { optional: true })
  if (!root) throw new Error(`rindRadioGroup${part} must be inside rindRadioGroupRoot`)
  return root
}
function injectItem(part: string): RadioGroupItem {
  const item = inject(ITEM, { optional: true })
  if (!item) throw new Error(`rindRadioGroup${part} must be inside rindRadioGroupItem`)
  return item
}

/** `undefined` stays undefined (the host's or the default); a bare attribute is `true`. */
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A set of radios with one value: `<div rindRadioGroupRoot [(value)]="size">` with a Label and
 * `rindRadioGroupItem` items, each holding an ItemControl and an ItemLabel.
 */
@Directive({
  selector: "[rindRadioGroupRoot]",
  exportAs: "rindRadioGroupRoot",
  providers: [{ provide: GROUP, useExisting: forwardRef(() => RadioGroupRoot) }],
})
export class RadioGroupRoot {
  /** Controlled value (`[(value)]`). */
  readonly value = input<string | null>()
  readonly defaultValue = input<string | null>()
  /** Only `aria-orientation` and `data-orientation`: every arrow key moves. */
  readonly orientation = input<"vertical" | "horizontal">("vertical")
  /** Disables every radio. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** A disabled group stays discoverable: the root is one tab stop. */
  readonly focusableWhenDisabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Navigable, never changes. */
  readonly readonly = input(false, { transform: booleanAttribute })
  /** Valid with one radio checked. */
  readonly required = input(false, { transform: booleanAttribute })
  /** Marks the group invalid; shows the ErrorMessage. */
  readonly invalid = input(false, { transform: booleanAttribute })
  /** Default: derived from the root id (two groups never form one browser group). */
  readonly name = input<string>()
  /** The id of the form the hidden inputs belong to. */
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
  readonly api: (pendingStop?: string | null) => ReturnType<typeof radioGroupConnect>
  /** @internal */
  readonly send: (event: RadioGroupEvent) => void
  /** @internal */
  readonly registry: ReturnType<typeof injectCollectionItems>["registry"]
  /** @internal */
  readonly parts: () => PartRegistry<GroupPart>
  /** @internal */
  readonly ids: () => ReturnType<typeof radioGroupIds>
  /** @internal */
  readonly current: () => string | null
  /** @internal */
  readonly groupDisabled: () => boolean
  /** @internal */
  readonly inField: boolean
  /** @internal */
  readonly isInvalid: () => boolean
  /** @internal A user change waiting for its commit: that item's input dispatches input + change. */
  readonly pending: { current: string | null } = { current: null }
  /** @internal */
  readonly hostFocusableWhenDisabled: () => boolean
  /** @internal Hosted by a Toolbar: Enter checks (APG toolbar) and never submits. */
  readonly hosted: boolean
  /** @internal */
  readonly stop = declaredStop()
  /** The group's state, for the template (`#g="rindRadioGroupRoot"`, `g.state()`). */
  readonly state: Signal<RadioGroupState>

  constructor() {
    const env = injectEnvironment(announcerCapability, layoutCapability)
    const instance = injectRootId(() => this.id())
    const naming = inject(RADIO_NAMING, { optional: true })
    const ids = computed(() =>
      naming ? radioGroupIds(instance(), naming) : radioGroupIds(instance()),
    )
    this.ids = ids
    // The parts the effects below look up, under a host's names when the group is its part.
    const hiddenPart = naming ? radioPartName(naming, "hidden-input") : "hidden-input"
    const controlPart = naming?.control ?? "item-control"
    const binding = injectFieldControl()
    this.inField = binding !== null
    const fieldsetContext = injectFieldsetDisabled()
    const fieldsetDom = signal(false)
    // Hosted by a Toolbar: its disabled state applies, its focusableWhenDisabled unless ours.
    const host = injectCompositeHost()
    this.hosted = host !== null
    const focusableWhenDisabled = () =>
      this.focusableWhenDisabled() ?? host?.focusableWhenDisabled ?? false
    this.hostFocusableWhenDisabled = focusableWhenDisabled
    const ariaLabel = inject(new HostAttributeToken("aria-label"), { optional: true }) ?? undefined
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "radiogroup",
          labelable: false,
          disabled:
            this.disabled() || fieldsetContext() || fieldsetDom() || host?.disabled === true,
          readOnly: this.readonly(),
          required: this.required(),
          invalid: this.invalid(),
          name: this.name(),
          ariaLabel,
        },
        binding?.() ?? null,
      ),
    )
    this.groupDisabled = () => field().disabled
    this.isInvalid = () => field().invalid
    const { collection: registered, registry } = injectCollectionItems()
    this.registry = registry
    const collection = () => registered() ?? EMPTY
    const pending = this.pending
    // The reason of the latest accepted change, for the Field: only a user's clears its
    // external (server) errors (base-ui#1745); a parent's value or a reset does not.
    let lastReason: string | null = null
    const { view, send } = injectMachine(
      radioGroupMachine,
      () => ({
        collection: collection(),
        strategy: "roving" as const,
        ids: ids(),
        loop: true,
        selectionMode: "single" as const,
        focusableWhenDisabled: focusableWhenDisabled(),
        value: this.value(),
        defaultValue: this.defaultValue(),
        // A user change (an arrow or a press) is dispatched on that item's input after commit.
        onValueChange: (next: string | null, details: ChangeDetails<RadioGroupEvent>) => {
          lastReason = details.reason
          if (details.reason === "NAVIGATE" || details.reason === "PRESS") pending.current = next
          this.emit(next, details)
        },
        disabled: field().disabled,
        readOnly: field().readOnly,
      }),
      env,
    )
    this.send = send
    const current = () => view().values.value ?? null
    this.current = current
    // The Label is expected unless something else names the group: the server HTML then
    // already labels the root (base-ui#5597).
    this.parts = injectPartRegistry<GroupPart>(() => ({
      scope: "radio-group",
      root: instance(),
      ...(ariaLabel === undefined && binding === null ? { expected: ["label"] as const } : {}),
    }))
    const rendered = {
      label: injectRenderedId(this.parts, "label"),
      description: injectRenderedId(this.parts, "description"),
      errorMessage: injectRenderedId(this.parts, "error-message"),
    }
    this.api = (pendingStop: string | null = null) =>
      radioGroupConnect(
        {
          instance: instance(),
          ...(naming ? { naming } : {}),
          collection: collection(),
          value: current(),
          highlightedKey: view().context.highlightedKey,
          highlightSource: view().context.highlightSource,
          pending: registered() === null,
          pendingStop,
          orientation: this.orientation(),
          disabled: field().disabled,
          focusableWhenDisabled: focusableWhenDisabled(),
          readOnly: field().readOnly,
          required: field().required || field()["aria-required"] === "true",
          invalid: field().invalid,
          name: field().name,
          form: this.form(),
          rendered: {
            label: rendered.label(),
            description: rendered.description(),
            errorMessage: rendered.errorMessage(),
          },
          ...(binding ? { field: binding().ids } : {}),
          ariaLabel,
          hosted: host !== null,
        },
        send,
        env,
      )
    this.state = computed(() => ({ value: current(), disabled: field().disabled }))
    bindProps(
      () => ({
        ...this.api().root(),
        ...binding?.().data,
        ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel }),
      }),
      {
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
      },
    )

    if (inject(PLATFORM_ID) !== "browser") return
    const el: Element = inject(ElementRef).nativeElement
    const destroy = inject(DestroyRef)
    let ready = false
    afterNextRender(() => {
      ready = true
      const w = watchFieldsetDisabled(el, (d) => fieldsetDom.set(d))
      fieldsetDom.set(w.disabled)
      // A form reset is answered once, by the group (every item's input re-syncs).
      const doc = el.ownerDocument
      const onReset = (e: Event) => {
        if (e.defaultPrevented) return
        const control = el.querySelector<HTMLInputElement>(`[data-part="${hiddenPart}"]`)
        if (control && e.target === control.form) send({ type: "RESET" })
      }
      doc.addEventListener("reset", onReset)
      destroy.onDestroy(() => {
        w.stop()
        doc.removeEventListener("reset", onReset)
      })
      // field-control: the group registers once as one (non-labelable) control.
      if (binding) {
        const radios = () =>
          Array.from(
            el.querySelectorAll<HTMLElement>(
              `[data-part="${controlPart}"][data-instance="${instance()}"]`,
            ),
          )
        destroy.onDestroy(
          binding().register(
            {
              id: instance(),
              labelable: false,
              // The checked radio, else the first enabled one (react-spectrum#3883).
              focus: (modality) => {
                const all = radios()
                const target =
                  all.find((r) => r.getAttribute("aria-checked") === "true") ??
                  all.find(
                    (r) =>
                      r.getAttribute("aria-disabled") !== "true" && !r.hasAttribute("disabled"),
                  )
                if (target) void focusSafely(target, env, "programmatic", modality)
              },
              validityElement: () =>
                el.querySelector<HTMLInputElement>(`[data-part="${hiddenPart}"]`) ?? null,
              value: () => current(),
            },
            instance(),
          ),
        )
      }
    })
    let reported: string | null | undefined
    effect(() => {
      const now = current()
      if (!ready) {
        reported = now
        return
      }
      if (reported === now) return
      reported = now
      untracked(() => {
        const user = lastReason === "NAVIGATE" || lastReason === "PRESS"
        lastReason = null
        binding?.().report({ type: "change", value: now, user, composing: false })
        binding?.().report({ type: "commit" })
      })
    })
    // After the items' updates: a proposal the parent refused never dispatches later.
    let named = false
    afterEveryRender(() => {
      if (pending.current !== null && pending.current !== current()) pending.current = null
      // Development: a radiogroup needs a name. Checked after the render a Label's or a Field's
      // registration causes, not on the first one.
      if (process.env.NODE_ENV === "production" || named) return
      queueMicrotask(() => {
        if (!el.isConnected || named) return
        if (el.getAttribute("aria-labelledby") || el.getAttribute("aria-label")) {
          named = true
          return
        }
        named = true
        console.warn(
          `[rind-ui] radio-group: #${el.id} has no accessible name; render rindRadioGroupLabel or pass aria-label`,
        )
      })
    })
  }
}

/** Not a `<label>`: a radiogroup is not labelable. */
@Directive({ selector: "[rindRadioGroupLabel]", exportAs: "rindRadioGroupLabel" })
export class RadioGroupLabel {
  constructor() {
    const group = injectGroup("Label")
    injectRegisterPart(group.parts, "label", () => group.ids().label)
    bindProps(() => group.api().label())
  }
}

@Directive({ selector: "[rindRadioGroupDescription]", exportAs: "rindRadioGroupDescription" })
export class RadioGroupDescription {
  constructor() {
    const group = injectGroup("Description")
    injectRegisterPart(group.parts, "description", () => group.ids().description)
    bindProps(() => group.api().description())
  }
}

/** Shown while the group is invalid; inside a Field the Field's ErrorMessage is the one. */
@Directive({ selector: "[rindRadioGroupErrorMessage]", exportAs: "rindRadioGroupErrorMessage" })
export class RadioGroupErrorMessage {
  constructor() {
    const group = injectGroup("ErrorMessage")
    const shown = () => !group.inField && group.isInvalid()
    injectRegisterPart(group.parts, "error-message", () =>
      shown() ? group.ids().errorMessage : undefined,
    )
    bindProps(() =>
      shown()
        ? group.api().errorMessage()
        : absentProps("radio-group", String(group.api().root()["data-instance"])),
    )
  }
}

/**
 * A radio: `<div rindRadioGroupItem value="s">` with an ItemControl, an ItemLabel and an
 * ItemDescription; its hidden input follows the content (a sibling of the control, never inside
 * it: reka-ui#1597).
 */
@Component({
  selector: "[rindRadioGroupItem]",
  exportAs: "rindRadioGroupItem",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: ITEM, useExisting: forwardRef(() => RadioGroupItem) }],
  template: `<ng-content /><input #input [rindProps]="hiddenInput()" />`,
})
export class RadioGroupItem {
  /** The item's value: what the group's value and the form submit. */
  readonly value = input.required<string>()
  /** Disables this radio only. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** The text for the collection (defaults to the item's text content). */
  readonly textValue = input<string>()

  /** @internal */
  readonly group = injectGroup("Item")
  /** @internal */
  readonly key = (): CollectionKey => toKey(this.value())
  /** @internal */
  readonly controlTag = signal("button")
  /** @internal */
  readonly labelRendered = signal(false)
  /** @internal */
  readonly descriptionRendered = signal(false)
  /** @internal */
  readonly controlEl: { value: Element | null } = { value: null }
  /** @internal This item's view of the server tab stop (read once, in document order). */
  readonly pendingStop: () => string | null
  /** The radio's state, for the template (`#r="rindRadioGroupItem"`, `r.state()`). */
  readonly state: Signal<RadioItemState>
  /** @internal */
  protected readonly hiddenInput: Signal<PartProps>
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>("input")
  /** @internal */
  readonly inputEl = () => this.inputRef()?.nativeElement ?? null

  constructor() {
    const group = this.group
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    injectRegisterItem(
      group.registry,
      () => ({ key: this.value(), textValue: this.textValue(), disabled: this.disabled() }),
      el,
    )
    const checked = () => group.current() === this.key()
    this.pendingStop = () =>
      group.stop(
        this.value(),
        group.groupDisabled() || this.disabled(),
        group.current() === null ? [] : [group.current() as string],
      )
    this.state = computed(() => ({
      checked: checked(),
      disabled: group.groupDisabled() || this.disabled(),
    }))
    this.hiddenInput = computed(() =>
      group.api().hiddenInput(this.key(), { disabled: this.disabled() }),
    )
    bindProps(() => group.api().item(this.key(), { disabled: this.disabled() }), {
      owns: ["disabled", "textvalue", "value"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const formInput = hiddenFormInput(
      { input: this.inputEl, control: () => this.controlEl.value as HTMLElement | null },
      env,
    )
    // After every render: the input mirrors the value; the newly checked one, after a user
    // change, dispatches input + change (programmatic changes stay silent).
    afterEveryRender(() => {
      const dispatch = checked() && group.pending.current === this.key()
      formInput.sync({ checked: checked() }, { dispatch })
      if (dispatch) group.pending.current = null
    })
    const destroy = inject(DestroyRef)
    afterNextRender(() =>
      destroy.onDestroy(
        formInput.track({
          onReset: () => {},
          current: () => ({ checked: checked() }),
          // The group answers the reset once; each input only re-syncs.
          resetsWithForm: false,
        }),
      ),
    )
  }
}

/** The radio itself: `<button rindRadioGroupItemControl>`. */
@Directive({ selector: "[rindRadioGroupItemControl]", exportAs: "rindRadioGroupItemControl" })
export class RadioGroupItemControl {
  constructor() {
    const item = injectItem("ItemControl")
    const group = item.group
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    item.controlEl.value = el
    item.controlTag.set(el.tagName.toLowerCase())
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const disabled = () => group.groupDisabled() || item.disabled()
    const press = injectPress({
      env,
      send: (e) => {
        if (e.type === "PRESS") group.send({ type: "PRESS", key: item.key(), modality: e.modality })
      },
      disabled,
    })
    const hover = injectHover({ env, send: () => {}, disabled })
    // Hosted: the radio is also one of the host's controls (navigation and tab stop).
    const host = injectCompositeHost()
    const hostKey = () => group.ids().item(item.key())
    injectHostItem(
      host,
      // The toolbar has no typeahead: the value is enough to name the registration.
      () => ({
        id: hostKey(),
        skip: disabled() && !group.hostFocusableWhenDisabled(),
        textValue: item.key(),
      }),
      el,
    )
    bindProps(() => {
      const tag = item.controlTag()
      const labelable = tag === "button" || tag === "input"
      const hostProps = host
        ? host.itemProps({ id: hostKey(), disabled: disabled(), first: host.claimFirst(hostKey()) })
        : {}
      const own = group.api(item.pendingStop()).itemControl(item.key(), {
        tag,
        focused: focused(),
        modality: modality(),
        pressed: press.pressed(),
        hovered: hover.hovered(),
        itemDisabled: item.disabled(),
        labelable,
        labelRendered: item.labelRendered(),
        descriptionRendered: item.descriptionRendered(),
      })
      return joinHandlers(
        own,
        hostProps,
        {
          // Enter submits the form (implicit submission) and never checks; hosted by a toolbar,
          // Enter checks like Space (APG toolbar example) and never submits.
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
            if (!group.hosted) {
              implicitSubmit(item.inputEl()?.form ?? null)
              return
            }
            e.preventDefault()
            if (!disabled() && !e.repeat)
              group.send({ type: "PRESS", key: item.key(), modality: "keyboard" })
          },
        },
        press.props,
        hover.props,
        { onFocusIn: () => focused.set(true), onFocusOut: () => focused.set(false) },
      )
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // The modality tracker must see the pointerdown that comes before focus.
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
}

/** Shown only while its radio is checked (React renders nothing otherwise). */
@Directive({ selector: "[rindRadioGroupItemIndicator]", exportAs: "rindRadioGroupItemIndicator" })
export class RadioGroupItemIndicator {
  constructor() {
    const item = injectItem("ItemIndicator")
    const group = item.group
    bindProps(() =>
      group.current() === item.key()
        ? group.api().itemIndicator(item.key(), { disabled: item.disabled() })
        : absentProps("radio-group", String(group.api().root()["data-instance"])),
    )
  }
}

/** The radio's label: `<label rindRadioGroupItemLabel>`. */
@Directive({ selector: "[rindRadioGroupItemLabel]", exportAs: "rindRadioGroupItemLabel" })
export class RadioGroupItemLabel {
  constructor() {
    const item = injectItem("ItemLabel")
    item.labelRendered.set(true)
    inject(DestroyRef).onDestroy(() => item.labelRendered.set(false))
    bindProps(() =>
      item.group.api().itemLabel(item.key(), {
        disabled: item.disabled(),
        labelable: item.controlTag() === "button" || item.controlTag() === "input",
      }),
    )
  }
}

@Directive({
  selector: "[rindRadioGroupItemDescription]",
  exportAs: "rindRadioGroupItemDescription",
})
export class RadioGroupItemDescription {
  constructor() {
    const item = injectItem("ItemDescription")
    item.descriptionRendered.set(true)
    inject(DestroyRef).onDestroy(() => item.descriptionRendered.set(false))
    bindProps(() => item.group.api().itemDescription(item.key(), { disabled: item.disabled() }))
  }
}

/** The Radio Group's parts, for a standalone component's `imports`. */
export const RadioGroup = [
  RadioGroupRoot,
  RadioGroupLabel,
  RadioGroupDescription,
  RadioGroupErrorMessage,
  RadioGroupItem,
  RadioGroupItemControl,
  RadioGroupItemIndicator,
  RadioGroupItemLabel,
  RadioGroupItemDescription,
] as const
