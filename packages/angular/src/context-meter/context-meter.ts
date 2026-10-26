// Context Meter (add-context-meter): the attributes come from the props (connect is pure); the
// machine only announces a rising threshold crossing, once, and re-arms on `resetKey`.
import {
  Component,
  computed,
  Directive,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
  type Signal,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type ContextMeterLevel,
  type ContextMeterMessages,
  type ContextMeterState,
  contextMeterConnect,
  contextMeterMachine,
  contextMeterMessages,
  type MessageOverrides,
  partId,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"

/** The meter's state, for the template (`#m="rindContextMeterRoot"`, `m.state()`). */
export interface ContextMeterRenderState {
  readonly state: ContextMeterState
  /** 0–100, one decimal. */
  readonly percent: number
  /** The value in words ("17K of 100K tokens, 17%"). */
  readonly valueText: string
}

const CONTEXT_METER = new InjectionToken<ContextMeterRoot>("rind-ui.context-meter")

function injectContextMeter(part: string): ContextMeterRoot {
  const root = inject(CONTEXT_METER, { optional: true })
  if (!root) throw new Error(`rindContextMeter${part} must be inside rindContextMeterRoot`)
  return root
}

/**
 * How much of a model's context window a thread uses:
 * `<div rindContextMeterRoot [used]="tokens" [max]="window">` with a Label, a ValueText and a
 * Track holding the Indicator; a Breakdown says where the tokens went.
 */
@Directive({
  selector: "[rindContextMeterRoot]",
  exportAs: "rindContextMeterRoot",
  providers: [{ provide: CONTEXT_METER, useExisting: forwardRef(() => ContextMeterRoot) }],
})
export class ContextMeterRoot {
  /** Tokens used. */
  readonly used = input.required<number>()
  /** The window size; null when unknown (text, no meter role). */
  readonly max = input.required<number | null>()
  /** The warning threshold (fraction). Default 0.75. */
  readonly warnAt = input<number>()
  /** The full threshold (fraction). Default 0.95. */
  readonly fullAt = input<number>()
  /** Announce a rising threshold crossing, once. Default "polite". */
  readonly announce = input<"off" | "polite">()
  /** A new value (a new thread) re-arms the thresholds. */
  readonly resetKey = input<string>()
  /** How the numbers are written. Default: compact notation. */
  readonly formatOptions = input<Intl.NumberFormatOptions>()
  readonly messages = input<MessageOverrides<ContextMeterMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  readonly id = input<string>()
  /** A rising crossing (compact the thread here). */
  readonly threshold = output<ContextMeterLevel>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof contextMeterConnect>>
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"label">>
  /** @internal */
  readonly labelId: () => string
  readonly state: Signal<ContextMeterRenderState>

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment(announcerCapability)
    const messages = injectMessages("context-meter", contextMeterMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    this.registry = injectPartRegistry<"label">(() => ({
      scope: "context-meter",
      root: instance(),
    }))
    this.labelId = () => partId("context-meter", instance(), "label")
    const rendered = injectRenderedId(this.registry, "label")
    injectMachine(
      contextMeterMachine,
      () => ({
        used: this.used(),
        max: this.max(),
        warnAt: this.warnAt(),
        fullAt: this.fullAt(),
        announce: this.announce(),
        resetKey: this.resetKey(),
        onThreshold: (l: ContextMeterLevel) => this.threshold.emit(l),
        messages: messages(),
        id: instance(),
        lang: locale().locale,
      }),
      env,
    )
    this.api = computed(() =>
      contextMeterConnect({
        instance: instance(),
        used: this.used(),
        max: this.max(),
        warnAt: this.warnAt(),
        fullAt: this.fullAt(),
        locale: locale().locale,
        formatOptions: this.formatOptions(),
        messages: messages(),
        ids: { label: rendered() ?? this.labelId() },
        rendered: { label: rendered() !== undefined },
      }),
    )
    this.state = computed(() => ({
      state: this.api().state,
      percent: this.api().percent,
      valueText: this.api().valueText,
    }))
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "announce",
          "formatoptions",
          "fullat",
          "id",
          "locale",
          "max",
          "messages",
          "resetkey",
          "used",
          "warnat",
        ],
      },
    )
  }
}

/** Names the meter. */
@Directive({ selector: "[rindContextMeterLabel]", exportAs: "rindContextMeterLabel" })
export class ContextMeterLabel {
  readonly id = input<string>()
  constructor() {
    const root = injectContextMeter("Label")
    const own = () => this.id() ?? root.labelId()
    injectRegisterPart(root.registry, "label", own)
    bindProps(() => ({ ...root.api().label(), id: own() }), { owns: ["id"] })
  }
}

/** The short visible value ("17%"); `aria-hidden` (the meter says it in full). */
@Component({
  selector: "[rindContextMeterValueText]",
  exportAs: "rindContextMeterValueText",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ContextMeterValueText {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectContextMeter("ValueText")
    this.text = computed(() => root.api().shortText)
    bindProps(() => root.api().valueTextPart())
  }
}

/** `aria-hidden`; holds the Indicator. */
@Directive({ selector: "[rindContextMeterTrack]", exportAs: "rindContextMeterTrack" })
export class ContextMeterTrack {
  constructor() {
    const root = injectContextMeter("Track")
    bindProps(() => root.api().track())
  }
}

/** `aria-hidden`; sized by `--rind-context-meter-percent`. */
@Directive({ selector: "[rindContextMeterIndicator]", exportAs: "rindContextMeterIndicator" })
export class ContextMeterIndicator {
  constructor() {
    const root = injectContextMeter("Indicator")
    bindProps(() => root.api().indicator())
  }
}

/** Where the tokens went: `<dl rindContextMeterBreakdown>`. */
@Directive({ selector: "[rindContextMeterBreakdown]", exportAs: "rindContextMeterBreakdown" })
export class ContextMeterBreakdown {
  constructor() {
    const root = injectContextMeter("Breakdown")
    bindProps(() => root.api().breakdown())
  }
}

/**
 * One `dt`/`dd` pair: `<div rindContextMeterBreakdownItem itemKey="system" label="System prompt"
 * amount="2K">`, or your own `dt` and `dd` as its content.
 */
@Component({
  selector: "[rindContextMeterBreakdownItem]",
  exportAs: "rindContextMeterBreakdownItem",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content><dt>{{ label() }}</dt><dd>{{ amount() }}</dd></ng-content>",
})
export class ContextMeterBreakdownItem {
  /** Identifies the row (`data-key`). */
  readonly itemKey = input.required<string>()
  /** The `dt`: what the tokens went to ("System prompt"). */
  readonly label = input<string>()
  /** The `dd`: how many ("2.1K tokens"). */
  readonly amount = input<string>()
  constructor() {
    const root = injectContextMeter("BreakdownItem")
    bindProps(() => root.api().breakdownItem(this.itemKey()), {
      owns: ["amount", "itemkey", "label"],
    })
  }
}

/** The Context Meter's parts, for a standalone component's `imports`. */
export const ContextMeter = [
  ContextMeterRoot,
  ContextMeterLabel,
  ContextMeterValueText,
  ContextMeterTrack,
  ContextMeterIndicator,
  ContextMeterBreakdown,
  ContextMeterBreakdownItem,
] as const
