// Color Swatch parts: wiring only; connect decides role, name and the inline colour. Internal:
// the Color Picker's Swatch and ValueSwatch are built on them.
import { computed, Directive, HostAttributeToken, inject, input, type Signal } from "@angular/core"
import type { Color, ColorInput, ColorNameProp, MessageOverrides, PartProps } from "@rind-ui/core"
import {
  type ColorSwatchMessages,
  colorSwatchConnect,
  colorSwatchMessages,
  swatchColor,
  transparencyGridProps,
} from "@rind-ui/core/internal"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectLocale, injectMessages } from "../provider"

export interface ColorSwatchState {
  readonly color: Color
  readonly transparent: boolean
}

/** The swatch's props for a colour; shared with the parts that show one. Call in a constructor. */
export function injectSwatchProps(options: {
  readonly id?: () => string | undefined
  readonly color: () => ColorInput | undefined
  readonly respectAlpha?: () => boolean | undefined
  readonly colorName?: () => ColorNameProp | undefined
  readonly locale?: () => string | undefined
  readonly messages?: () => MessageOverrides<ColorSwatchMessages> | undefined
  readonly ariaLabel?: string | undefined
  readonly decorative?: boolean
}) {
  const instance = injectRootId(options.id ?? (() => undefined))
  const loc = injectLocale(options.locale ?? (() => undefined))
  const messages = injectMessages("color-swatch", colorSwatchMessages, options.messages)
  return computed(() => {
    const color = swatchColor(options.color())
    const api = colorSwatchConnect({
      instance: instance(),
      color,
      respectAlpha: options.respectAlpha?.(),
      messages: messages(),
      locale: loc().locale,
      colorName: options.colorName?.(),
      ariaLabel: options.ariaLabel,
      decorative: options.decorative,
    })
    return { color, api }
  })
}

/** A swatch under a host's names (the Color Picker's `swatch` and `value-swatch`). Internal. */
@Directive()
export abstract class ColorSwatchBase {
  /** Default transparent black. */
  readonly color = input<ColorInput>()
  /** `false`: the opaque colour (default true). */
  readonly respectAlpha = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** A fixed name (a design token) or a function replacing the computed name. */
  readonly colorName = input<ColorNameProp>()
  /** Formats the transparency percentage. Default: the provider's locale. */
  readonly locale = input<string>()
  /** The role description and the colour words. */
  readonly messages = input<MessageOverrides<ColorSwatchMessages>>()
  readonly id = input<string>()

  /** @internal */
  protected readonly swatch: ReturnType<typeof injectSwatchProps>
  /** The swatch's state, for the template (`#s="…"`, `s.state()`). */
  readonly state: Signal<ColorSwatchState>

  constructor(
    naming: { readonly scope: string; readonly part: string } | null,
    own: {
      readonly color?: () => ColorInput | undefined
      readonly messages?: () => MessageOverrides<ColorSwatchMessages> | undefined
      readonly colorName?: () => ColorNameProp | undefined
      readonly locale?: () => string | undefined
      readonly decorative?: boolean
    } = {},
  ) {
    // The name the consumer gives is the swatch's label (connect composes it with the colour).
    const ariaLabel = inject(new HostAttributeToken("aria-label"), { optional: true }) ?? undefined
    this.swatch = injectSwatchProps({
      id: () => this.id(),
      color: () => this.color() ?? own.color?.(),
      respectAlpha: () => this.respectAlpha(),
      colorName: () => this.colorName() ?? own.colorName?.(),
      locale: () => this.locale() ?? own.locale?.(),
      messages: () => this.messages() ?? own.messages?.(),
      ariaLabel,
      ...(own.decorative ? { decorative: true } : {}),
    })
    this.state = computed(() => {
      const { color } = this.swatch()
      return { color, transparent: (this.respectAlpha() === false ? 1 : color.alpha) < 1 }
    })
    bindProps(
      () => {
        const { api } = this.swatch()
        return naming ? api.root(naming.scope, naming.part) : api.root()
      },
      {
        owns: ["aria-label", "color", "colorname", "id", "locale", "messages", "respectalpha"],
      },
    )
  }
}

/** A chip that shows a colour and names it for assistive technology. Internal. */
@Directive({ selector: "[rindColorSwatchRoot]", exportAs: "rindColorSwatchRoot" })
export class ColorSwatchRoot extends ColorSwatchBase {
  constructor() {
    super(null)
  }
}

/** A decorative checkerboard filling its parent, under a colour that has transparency. */
@Directive()
export abstract class TransparencyGridBase {
  constructor(scope: string, extra: () => PartProps = () => ({})) {
    const instance = injectRootId(() => undefined)
    bindProps(() => ({ ...transparencyGridProps(scope, instance()), ...extra() }))
  }
}

/** The Color Swatch's checkerboard. Internal. */
@Directive({
  selector: "[rindColorSwatchTransparencyGrid]",
  exportAs: "rindColorSwatchTransparencyGrid",
})
export class ColorSwatchTransparencyGrid extends TransparencyGridBase {
  constructor() {
    super("color-swatch")
  }
}
