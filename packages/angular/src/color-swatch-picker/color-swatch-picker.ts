// Color Swatch Picker parts (design §7): a Radio Group whose value is the key of the swatch
// matching the colour. Wiring only: matching is core's `matchSwatch`, every keyboard, focus and
// form rule is the Radio Group's. Internal: the Color Picker's Swatch Group is built on it.
import {
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
} from "@angular/core"
import {
  type Color,
  type ColorChangeDetails,
  type ColorInput,
  type ColorNameProp,
  type MessageOverrides,
  makeColor,
  type PartProps,
  resolveColorName,
  toSpace,
} from "@rind-ui/core"
import {
  COLOR_PICKER_SCOPE,
  type ColorSwatchPickerMessages,
  colorSwatchPickerMessages,
  colorVariables,
  matchSwatch,
  pickedColor,
  type SwatchItem,
  swatchColor,
  swatchGroupNaming,
  swatchKey,
} from "@rind-ui/core/internal"
import { bindProps } from "../bind-props"
import { injectColorBinding } from "../color-binding"
import { colorReader } from "../color-input"
import { ColorSwatchBase } from "../color-swatch/color-swatch"
import { injectLocale, injectMessages } from "../provider"
import {
  RADIO_ITEM,
  RADIO_NAMING,
  RADIO_OVERRIDE,
  RadioGroupItemControl,
  RadioGroupItemIndicator,
  RadioGroupRoot,
  type RadioGroupSource,
  RadioItemBase,
} from "../radio-group/radio-group"
import { RindProps } from "../rind-props"

export interface ColorSwatchPickerChangeDetails extends ColorChangeDetails {
  /** The checked item's key. */
  readonly value: string
  readonly index: number
}

type Registered = SwatchItem & { readonly el: Element }

const PICKER = new InjectionToken<ColorSwatchPickerRoot>("rind-ui.color-swatch-picker")

function injectPicker(part: string): ColorSwatchPickerRoot {
  const root = inject(PICKER, { optional: true })
  if (!root)
    throw new Error(`rindColorSwatchPicker${part} must be inside rindColorSwatchPickerRoot`)
  return root
}

/** The registered items in document order (a re-registered item would otherwise move last). */
function inDocumentOrder(items: readonly Registered[]): readonly Registered[] {
  return [...items].sort((a, b) =>
    a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )
}

/**
 * A palette of colour swatches: at most one matches the colour (a Radio Group). Inside a Color
 * Picker it is the picker's Swatch Group, bound to its colour.
 */
@Directive({
  selector: "[rindColorSwatchPickerRoot], [rindColorPickerSwatchGroup]",
  exportAs: "rindColorSwatchPickerRoot",
  hostDirectives: [RadioGroupRoot],
  providers: [
    { provide: PICKER, useExisting: forwardRef(() => ColorSwatchPickerRoot) },
    { provide: RADIO_NAMING, useValue: swatchGroupNaming },
    { provide: RADIO_OVERRIDE, useFactory: () => ({ source: {} }) },
  ],
})
export class ColorSwatchPickerRoot {
  /** The colour (`[(value)]`); null: no swatch checked. */
  readonly value = input<ColorInput | null>()
  /** Default `null`: no swatch checked. */
  readonly defaultValue = input<ColorInput | null>()
  /** Formats the swatches' colour names. Default: the provider's. */
  readonly locale = input<string>()
  /** The group's label (`swatchPickerLabel`) and the colour words. */
  readonly messages = input<MessageOverrides<ColorSwatchPickerMessages>>()
  /** The submitted name of the checked swatch's key. */
  readonly name = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly readonly = input(false, { transform: booleanAttribute })
  /** Default `horizontal`. */
  readonly orientation = input<"vertical" | "horizontal">("horizontal")
  /** A swatch was checked; `details.value` is its key, `details.index` its index. */
  readonly valueChangeDetails = output<{ value: Color; details: ColorSwatchPickerChangeDetails }>()
  /** The accepted colour, for `[(value)]`. */
  readonly valueChange = output<Color>()

  /** @internal */
  readonly texts: Signal<ColorSwatchPickerMessages>
  /** @internal */
  readonly localeName: () => string
  /** @internal */
  readonly register: (item: Registered) => () => void

  constructor() {
    const binding = injectColorBinding()
    const loc = injectLocale(() => this.locale() ?? binding?.locale())
    this.localeName = () => loc().locale
    this.texts = injectMessages(
      "color-swatch-picker",
      colorSwatchPickerMessages,
      () => this.messages() ?? binding?.messages(),
    )
    const parsed = colorReader(() => this.value() ?? undefined, "value", "color-swatch-picker")
    const parsedDefault = colorReader(
      () => this.defaultValue() ?? undefined,
      "defaultValue",
      "color-swatch-picker",
    )
    // Uncontrolled: the default until the first pick (the default is read once).
    const internal = signal<Color | null | undefined>(undefined)
    const controlled = () => binding !== null || this.value() !== undefined
    const color = (): Color | null => {
      if (binding) return binding.color()
      if (controlled()) return this.value() === null ? null : (parsed() ?? null)
      const own = internal()
      return own === undefined ? (untracked(parsedDefault) ?? null) : own
    }
    const items = signal<readonly Registered[]>([])
    this.register = (item) => {
      items.update((all) => [...all.filter((i) => i.key !== item.key), item])
      return () => items.update((all) => all.filter((i) => i.key !== item.key))
    }
    let lastKey: string | null = null
    const ordered = computed(() => inDocumentOrder(items()))
    const staticLabel = inject(new HostAttributeToken("aria-label"), { optional: true })
    const labelledBy = inject(new HostAttributeToken("aria-labelledby"), { optional: true })
    const source: RadioGroupSource = {
      value: () => matchSwatch(ordered(), color(), lastKey),
      orientation: () => this.orientation(),
      disabled: () => binding?.disabled() ?? this.disabled(),
      readOnly: () => binding?.readOnly() ?? this.readonly(),
      name: () => this.name(),
      ariaLabel: () =>
        labelledBy === null ? (staticLabel ?? this.texts().swatchPickerLabel) : undefined,
      onValueChange: (key, details) => {
        const all = untracked(ordered)
        const index = all.findIndex((i) => i.key === key)
        const item = all[index]
        const current = untracked(color)
        if (!item || key === null) return
        const next = pickedColor(item.color, current)
        const emitted = current ? toSpace(next, current.space) : next
        let cancelled = false
        this.valueChangeDetails.emit({
          value: emitted,
          details: {
            reason: details.reason,
            space: emitted.space,
            value: key,
            index,
            cancel: () => {
              cancelled = true
              details.cancel()
            },
          },
        })
        if (cancelled) return
        lastKey = key
        if (binding) {
          binding.set(emitted, "SWATCH")
          binding.commit("SWATCH")
        }
        this.valueChange.emit(emitted)
        if (!controlled()) internal.set(emitted)
      },
    }
    inject(RADIO_OVERRIDE, { self: true }).source = source
    bindProps(() => ({}), {
      owns: ["defaultvalue", "locale", "messages", "orientation", "value"],
    })
  }
}

/** The item's colour, for the Swatch inside it. */
const SWATCH_ITEM = new InjectionToken<() => Color>("rind-ui.color-swatch-picker-item")

/**
 * One swatch: a Radio Group item and its control (`role="radio"`), named by its colour:
 * `<div rindColorSwatchPickerItem color="#FF3D8B">` (its content goes in the control).
 */
@Component({
  selector: "[rindColorSwatchPickerItem], [rindColorPickerSwatchTrigger]",
  exportAs: "rindColorSwatchPickerItem",
  imports: [RadioGroupItemControl, RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [
    { provide: RADIO_ITEM, useExisting: forwardRef(() => ColorSwatchPickerItem) },
    { provide: SWATCH_ITEM, useFactory: () => inject(ColorSwatchPickerItem).swatch },
  ],
  template: `<button rindRadioGroupItemControl><ng-content /></button><input #input [rindProps]="hiddenInput()" />`,
})
export class ColorSwatchPickerItem extends RadioItemBase {
  /** The swatch's colour: a colour, or a string `parseColor` reads. */
  readonly color = input.required<ColorInput>()
  /** The item's key (default the canonical `#RRGGBBAA`). */
  readonly key_ = input<string | undefined>(undefined, { alias: "value" })
  readonly disabled_ = input(false, { alias: "disabled", transform: booleanAttribute })
  /** A fixed name or a function replacing the computed colour name (the swatch's accessible name). */
  readonly colorName = input<ColorNameProp>()

  /** @internal */
  readonly swatch = computed(() => swatchColor(this.color()))
  readonly value = () => this.key_() ?? swatchKey(this.swatch())
  readonly disabled = () => this.disabled_()
  readonly textValue = (): string | undefined => this.name()
  private readonly picker = injectPicker("Item")
  private readonly label =
    inject(new HostAttributeToken("aria-label"), { optional: true }) ?? undefined
  private readonly name = computed(() => {
    const c = this.swatch()
    const opaque = makeColor(c.space, c.channels, 1)
    return resolveColorName(
      c.alpha < 1 ? c : opaque,
      this.picker.texts(),
      this.picker.localeName(),
      this.colorName(),
    )
  })

  constructor() {
    super()
    bindProps(() => ({}), { owns: ["aria-label", "color", "colorname"] })
    if (inject(PLATFORM_ID) !== "browser") return
    const el: Element = inject(ElementRef).nativeElement
    // The colour is compared by its key: a fresh object for the same colour re-registers nothing.
    let stop: (() => void) | undefined
    let last = ""
    effect(() => {
      const key = this.value()
      const colorKey = swatchKey(this.swatch())
      const disabled = this.disabled()
      const id = `${key}|${colorKey}|${disabled}`
      if (id === last) return
      last = id
      untracked(() => {
        stop?.()
        stop = this.picker.register({ key, color: this.swatch(), disabled, el })
      })
    })
    inject(DestroyRef).onDestroy(() => stop?.())
  }

  /** @internal */
  override controlExtra(): PartProps {
    const name = this.name()
    return {
      "data-value": this.value(),
      "aria-label": this.label ? `${name}, ${this.label}` : name,
      style: colorVariables(this.swatch()),
    }
  }
}

/** The item's colour: a decorative Color Swatch (the item's name carries the colour). */
@Directive({
  selector: "[rindColorSwatchPickerSwatch]",
  exportAs: "rindColorSwatchPickerSwatch",
})
export class ColorSwatchPickerSwatch extends ColorSwatchBase {
  constructor() {
    const color = inject(SWATCH_ITEM, { optional: true })
    if (!color)
      throw new Error("rindColorSwatchPickerSwatch must be inside rindColorSwatchPickerItem")
    super({ scope: COLOR_PICKER_SCOPE, part: "swatch" }, { color, decorative: true })
  }
}

/** Shown only while the item is checked: the one selected mark, decorative. */
@Directive({
  selector: "[rindColorSwatchPickerIndicator], [rindColorPickerSwatchIndicator]",
  exportAs: "rindColorSwatchPickerIndicator",
  hostDirectives: [RadioGroupItemIndicator],
})
export class ColorSwatchPickerIndicator {
  constructor() {
    bindProps(() => ({ "aria-hidden": "true" }))
  }
}

/** The Color Swatch Picker's parts. Internal. */
export const ColorSwatchPicker = [
  ColorSwatchPickerRoot,
  ColorSwatchPickerItem,
  ColorSwatchPickerSwatch,
  ColorSwatchPickerIndicator,
] as const
