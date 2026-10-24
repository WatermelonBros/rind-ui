import {
  afterRenderEffect,
  Component,
  computed,
  Directive,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  ViewEncapsulation,
} from "@angular/core"
import {
  checkMeterValue,
  checkRangeName,
  type MessageOverrides,
  type MeterMessages,
  type MeterValueTextArgs,
  type MeterZone,
  meterConnect,
  meterMachine,
  meterMessages,
  meterZone,
  partId,
  quirkActive,
  type RangeOrientation,
  rangeFillerProps,
  rangeValueText,
  resolveRangeValue,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { RindProps } from "../rind-props"

/** The meter's state, for the template (`#m="rindMeterRoot"`, `m.state()`). */
export interface MeterRenderState {
  readonly value: number
  readonly percent: number
  readonly zone: MeterZone | undefined
  readonly valueText: string | undefined
}

const METER = new InjectionToken<MeterRoot>("rind-ui.meter")

/** The root inside which a part is written. */
function injectMeter(part: string): MeterRoot {
  const root = inject(METER, { optional: true })
  if (!root) throw new Error(`rindMeter${part} must be inside rindMeterRoot`)
  return root
}

/**
 * A measurement in a known range: `<div rindMeterRoot [value]="75">` with a Label, a ValueText
 * and a Track holding the Indicator.
 */
@Component({
  selector: "[rindMeterRoot]",
  exportAs: "rindMeterRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: METER, useExisting: forwardRef(() => MeterRoot) }],
  // NVDA names a meter from its content: an empty filler span keeps it from reading the label
  // twice (the `nvda-progressbar-name` quirk).
  template: `<ng-content />@if (filler()) {<span [rindProps]="fillerProps"></span>}`,
})
export class MeterRoot {
  /** Required: a meter is never indeterminate. */
  readonly value = input.required<number>()
  readonly min = input<number>()
  readonly max = input<number>()
  /** HTML `<meter>` regions: `low`, `high` and where the `optimum` lies. */
  readonly low = input<number>()
  readonly high = input<number>()
  readonly optimum = input<number>()
  readonly orientation = input<RangeOrientation>("horizontal")
  /** Default `{ style: "percent" }`: the fraction; any other style formats the value. */
  readonly formatOptions = input<Intl.NumberFormatOptions>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  readonly messages = input<MessageOverrides<MeterMessages>>()
  readonly id = input<string>()

  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly registry: () => PartRegistry<"label">
  /** @internal */
  readonly api: () => ReturnType<typeof meterConnect>
  /** The meter's state, for the template. */
  readonly state: () => MeterRenderState
  /** @internal */
  protected readonly filler: () => boolean
  /** @internal */
  protected readonly fillerProps = rangeFillerProps

  constructor() {
    const env = injectEnvironment()
    const messages = injectMessages("meter", meterMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    // A consumer name replaces the Label: then the Label is not expected on the server.
    const own = {
      "aria-label": inject(new HostAttributeToken("aria-label"), { optional: true }) ?? undefined,
      "aria-labelledby":
        inject(new HostAttributeToken("aria-labelledby"), { optional: true }) ?? undefined,
      "aria-hidden": inject(new HostAttributeToken("aria-hidden"), { optional: true }) ?? undefined,
    }
    const named = own["aria-label"] !== undefined || own["aria-labelledby"] !== undefined
    this.registry = injectPartRegistry<"label">(() =>
      named
        ? { scope: "meter", root: this.instance() }
        : { scope: "meter", root: this.instance(), expected: ["label"] },
    )
    injectMachine(meterMachine, () => ({
      value: this.value(),
      min: this.min(),
      max: this.max(),
      low: this.low(),
      high: this.high(),
      optimum: this.optimum(),
    }))
    const labelledBy = injectRenderedId(this.registry, "label")
    const derived = computed(() => {
      const resolved = resolveRangeValue(
        { value: this.value(), min: this.min(), max: this.max() },
        "meter",
      )
      // A missing value renders as min (development error below): never indeterminate.
      const range = resolved.value === null ? { ...resolved, value: resolved.min } : resolved
      const zone = meterZone(range, { low: this.low(), high: this.high(), optimum: this.optimum() })
      const text = rangeValueText<MeterValueTextArgs>(
        range,
        { locale: locale().locale, formatOptions: this.formatOptions() },
        messages().valueText,
        { zone },
      )
      const api = meterConnect({
        instance: this.instance(),
        range,
        zone,
        text,
        orientation: this.orientation(),
        labelledBy: named ? undefined : labelledBy(),
      })
      const state: MeterRenderState = {
        value: range.value ?? range.min,
        percent: range.percent,
        zone,
        valueText: text,
      }
      return { api, state }
    })
    this.api = () => derived().api
    this.state = () => derived().state
    this.filler = () => quirkActive("nvda-progressbar-name", env)
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "formatoptions",
          "high",
          "id",
          "locale",
          "low",
          "max",
          "messages",
          "min",
          "optimum",
          "orientation",
          "value",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // After the first render, once per change of what they read (the Label registers by then).
    let last: string | undefined
    let lastValue: number | undefined
    afterRenderEffect(() => {
      const hasLabel = labelledBy() !== undefined
      if (String(hasLabel) !== last) {
        last = String(hasLabel)
        checkRangeName("meter", own, hasLabel || named)
      }
      const value = this.value()
      if (value !== lastValue) {
        lastValue = value
        checkMeterValue(value)
      }
    })
  }
}

/** The name: Root is `aria-labelledby` it while it is rendered. */
@Directive({ selector: "[rindMeterLabel]", exportAs: "rindMeterLabel" })
export class MeterLabel {
  readonly id = input<string>()
  constructor() {
    const root = injectMeter("Label")
    const labelId = () => this.id() ?? partId("meter", root.instance(), "label")
    injectRegisterPart(root.registry, "label", labelId)
    bindProps(() => root.api().label(labelId()), { owns: ["id"] })
  }
}

/**
 * The visible value text, `aria-hidden` (Root carries it as `aria-valuetext`): its content, or
 * the formatted value when it has none.
 */
@Component({
  selector: "[rindMeterValueText]",
  exportAs: "rindMeterValueText",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>{{ root.state().valueText }}</ng-content>`,
})
export class MeterValueText {
  /** @internal */
  protected readonly root = injectMeter("ValueText")
  constructor() {
    bindProps(() => this.root.api().valueText())
  }
}

@Directive({ selector: "[rindMeterTrack]" })
export class MeterTrack {
  constructor() {
    const root = injectMeter("Track")
    bindProps(() => root.api().track())
  }
}

/** The fill, sized by `--rind-meter-percent`. */
@Directive({ selector: "[rindMeterIndicator]" })
export class MeterIndicator {
  constructor() {
    const root = injectMeter("Indicator")
    bindProps(() => root.api().indicator())
  }
}

/** The Meter's parts, for a standalone component's `imports`. */
export const Meter = [MeterRoot, MeterLabel, MeterValueText, MeterTrack, MeterIndicator] as const
