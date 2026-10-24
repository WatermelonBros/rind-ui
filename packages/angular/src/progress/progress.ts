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
  announcerCapability,
  checkRangeName,
  type MessageOverrides,
  type ProgressMessages,
  type ProgressState,
  partId,
  progressConnect,
  progressMachine,
  progressMessages,
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

/** The progress bar's state, for the template (`#p="rindProgressRoot"`, `p.state()`). */
export interface ProgressRenderState {
  readonly state: ProgressState
  /** The clamped value; `null` when indeterminate. */
  readonly value: number | null
  readonly percent: number
  readonly valueText: string | undefined
}

const PROGRESS = new InjectionToken<ProgressRoot>("rind-ui.progress")

/** The root inside which a part is written. */
function injectProgress(part: string): ProgressRoot {
  const root = inject(PROGRESS, { optional: true })
  if (!root) throw new Error(`rindProgress${part} must be inside rindProgressRoot`)
  return root
}

/**
 * A progress bar: `<div rindProgressRoot [value]="40">` with a Label, a ValueText and a Track
 * holding the Indicator. `[value]="null"` (the default) is indeterminate.
 */
@Component({
  selector: "[rindProgressRoot]",
  exportAs: "rindProgressRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: PROGRESS, useExisting: forwardRef(() => ProgressRoot) }],
  // NVDA names a progressbar from its content: an empty filler span keeps it from reading
  // the label twice (the `nvda-progressbar-name` quirk).
  template: `<ng-content />@if (filler()) {<span [rindProps]="fillerProps"></span>}`,
})
export class ProgressRoot {
  /** `null` / `undefined` (the default): indeterminate. 0 is a value. */
  readonly value = input<number | null>(null)
  readonly min = input<number>()
  readonly max = input<number>()
  readonly orientation = input<RangeOrientation>("horizontal")
  /** Default `{ style: "percent" }`: the fraction; any other style formats the value. */
  readonly formatOptions = input<Intl.NumberFormatOptions>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  /** Announce `messages.complete` when the value reaches `max`. Never on mount. */
  readonly announceCompletion = input<boolean | undefined>(undefined)
  readonly messages = input<MessageOverrides<ProgressMessages>>()
  readonly id = input<string>()

  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly registry: () => PartRegistry<"label">
  /** @internal */
  readonly api: () => ReturnType<typeof progressConnect>
  /** The bar's state, for the template. */
  readonly state: () => ProgressRenderState
  /** @internal */
  protected readonly filler: () => boolean
  /** @internal */
  protected readonly fillerProps = rangeFillerProps

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const messages = injectMessages("progress", progressMessages, () => this.messages())
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
        ? { scope: "progress", root: this.instance() }
        : { scope: "progress", root: this.instance(), expected: ["label"] },
    )
    injectMachine(
      progressMachine,
      () => ({
        value: this.value(),
        min: this.min(),
        max: this.max(),
        announceCompletion: this.announceCompletion(),
        messages: messages(),
        id: this.instance(),
        lang: locale().locale,
      }),
      env,
    )
    const labelledBy = injectRenderedId(this.registry, "label")
    const derived = computed(() => {
      const range = resolveRangeValue(
        { value: this.value(), min: this.min(), max: this.max() },
        "progress",
      )
      const text = rangeValueText(
        range,
        { locale: locale().locale, formatOptions: this.formatOptions() },
        messages().valueText,
      )
      const api = progressConnect({
        instance: this.instance(),
        range,
        text,
        orientation: this.orientation(),
        labelledBy: named ? undefined : labelledBy(),
      })
      const state: ProgressRenderState = {
        state: api.state,
        value: range.value,
        percent: range.percent,
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
          "announcecompletion",
          "formatoptions",
          "id",
          "locale",
          "max",
          "messages",
          "min",
          "orientation",
          "value",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // After the first render, once per change of what it reads (the Label registers by then).
    let last: string | undefined
    afterRenderEffect(() => {
      const hasLabel = labelledBy() !== undefined
      const key = String(hasLabel)
      if (key === last) return
      last = key
      checkRangeName("progress", own, hasLabel || named)
    })
  }
}

/** The name: Root is `aria-labelledby` it while it is rendered. */
@Directive({ selector: "[rindProgressLabel]", exportAs: "rindProgressLabel" })
export class ProgressLabel {
  readonly id = input<string>()
  constructor() {
    const root = injectProgress("Label")
    const labelId = () => this.id() ?? partId("progress", root.instance(), "label")
    injectRegisterPart(root.registry, "label", labelId)
    bindProps(() => root.api().label(labelId()), { owns: ["id"] })
  }
}

/**
 * The visible value text, `aria-hidden` (Root carries it as `aria-valuetext`): its content, or
 * the formatted value when it has none.
 */
@Component({
  selector: "[rindProgressValueText]",
  exportAs: "rindProgressValueText",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>{{ root.state().valueText }}</ng-content>`,
})
export class ProgressValueText {
  /** @internal */
  protected readonly root = injectProgress("ValueText")
  constructor() {
    bindProps(() => this.root.api().valueText())
  }
}

@Directive({ selector: "[rindProgressTrack]" })
export class ProgressTrack {
  constructor() {
    const root = injectProgress("Track")
    bindProps(() => root.api().track())
  }
}

/** The fill, sized by `--rind-progress-percent`. */
@Directive({ selector: "[rindProgressIndicator]" })
export class ProgressIndicator {
  constructor() {
    const root = injectProgress("Indicator")
    bindProps(() => root.api().indicator())
  }
}

/** The ring's `<svg>` (`aria-hidden`); holds CircleTrack and CircleIndicator. */
@Directive({ selector: "[rindProgressCircle]" })
export class ProgressCircle {
  constructor() {
    const root = injectProgress("Circle")
    bindProps(() => root.api().circle())
  }
}

@Directive({ selector: "[rindProgressCircleTrack]" })
export class ProgressCircleTrack {
  constructor() {
    const root = injectProgress("CircleTrack")
    bindProps(() => root.api().circleTrack())
  }
}

/** The ring's arc: `stroke-dashoffset` = 100 − percent on a `pathLength` of 100. */
@Directive({ selector: "[rindProgressCircleIndicator]" })
export class ProgressCircleIndicator {
  constructor() {
    const root = injectProgress("CircleIndicator")
    bindProps(() => root.api().circleIndicator())
  }
}

/** The Progress's parts, for a standalone component's `imports`. */
export const Progress = [
  ProgressRoot,
  ProgressLabel,
  ProgressValueText,
  ProgressTrack,
  ProgressIndicator,
  ProgressCircle,
  ProgressCircleTrack,
  ProgressCircleIndicator,
] as const
