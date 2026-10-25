import {
  afterNextRender,
  Component,
  computed,
  Directive,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  type MessageOverrides,
  type TimelineAlign,
  type TimelineItemInput,
  type TimelineMessages,
  type TimelineOrientation,
  type TimelineStatus,
  timelineConnect,
  timelineMessages,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"

/** The timeline's state, for the template (`#t="rindTimelineRoot"`, `t.state()`). */
export interface TimelineRenderState {
  readonly orientation: TimelineOrientation
  readonly align: TimelineAlign
}

const TIMELINE = new InjectionToken<TimelineRoot>("rind-ui.timeline")
const ITEM = new InjectionToken<TimelineItem>("rind-ui.timeline-item")

function injectTimeline(part: string): TimelineRoot {
  const root = inject(TIMELINE, { optional: true })
  if (!root) throw new Error(`rindTimeline${part} must be inside rindTimelineRoot`)
  return root
}
function injectItem(part: string): TimelineItem {
  const item = inject(ITEM, { optional: true })
  if (!item) throw new Error(`rindTimeline${part} must be inside rindTimelineItem`)
  return item
}

/**
 * Events in order: `<ol rindTimelineRoot aria-label="Order" [current]="1">` with
 * `<li rindTimelineItem [index]="i">` events, each with its Indicator, Connector and Content.
 */
@Directive({
  selector: "[rindTimelineRoot]",
  exportAs: "rindTimelineRoot",
  providers: [{ provide: TIMELINE, useExisting: forwardRef(() => TimelineRoot) }],
})
export class TimelineRoot {
  /** The current event's index: earlier events are completed, later ones upcoming. */
  readonly current = input<number>()
  readonly orientation = input<TimelineOrientation>("vertical")
  /** Which side of the rail the content sits on; alternate switches per item. */
  readonly align = input<TimelineAlign>("start")
  readonly messages = input<MessageOverrides<TimelineMessages>>()
  /** Default: the provider's locale (Time's format). */
  readonly locale = input<string>()
  readonly id = input<string>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof timelineConnect>>
  /** @internal */
  readonly register: (index: number) => () => void
  /** @internal */
  readonly lang: Signal<string>
  readonly state: Signal<TimelineRenderState>

  constructor() {
    const instance = injectRootId(() => this.id())
    const locale = injectLocale(() => this.locale())
    this.lang = computed(() => locale().locale)
    const messages = injectMessages("timeline", timelineMessages, () => this.messages())
    const indexes = signal<ReadonlySet<number>>(new Set())
    this.register = (index) => {
      const now = untracked(indexes)
      if (!now.has(index)) indexes.set(new Set(now).add(index))
      return () => {
        const next = new Set(untracked(indexes))
        next.delete(index)
        indexes.set(next)
      }
    }
    this.api = computed(() =>
      timelineConnect({
        instance: instance(),
        orientation: this.orientation(),
        align: this.align(),
        current: this.current(),
        count: indexes().size === 0 ? 0 : Math.max(...indexes()) + 1,
        messages: messages(),
      }),
    )
    this.state = computed(() => ({ orientation: this.orientation(), align: this.align() }))
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      { owns: ["align", "current", "id", "locale", "messages", "orientation"] },
    )
  }
}

/** One event: `<li rindTimelineItem [index]="0" #e="rindTimelineItem">` (`e.status()`). */
@Directive({
  selector: "[rindTimelineItem]",
  exportAs: "rindTimelineItem",
  providers: [{ provide: ITEM, useExisting: forwardRef(() => TimelineItem) }],
})
export class TimelineItem {
  /** The event's index (0-based). */
  readonly index = input.required<number>()
  /** Its own status; wins over the Root's `current`. */
  readonly status = input<TimelineStatus>()
  /** @internal */
  readonly item = computed(
    (): TimelineItemInput => ({ index: this.index(), status: this.status() }),
  )
  /** The event's resolved status, for the template. */
  readonly resolved: Signal<TimelineStatus | undefined>

  constructor() {
    const root = injectTimeline("Item")
    this.resolved = computed(() => root.api().statusOf(this.item()))
    bindProps(() => root.api().item(this.item()), { owns: ["index", "status"] })
    if (inject(PLATFORM_ID) !== "browser") return
    // After the first render, as React (the count is known once the items registered).
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready()) return
      const index = this.index()
      onCleanup(untracked(() => root.register(index)))
    })
  }
}

/** An Item part's wiring: its props from connect. */
@Directive()
abstract class ItemPart {
  protected wire(name: "indicator" | "connector" | "content" | "description" | "opposite") {
    const label = name[0]?.toUpperCase() + name.slice(1)
    const root = injectTimeline(label)
    const item = injectItem(label)
    bindProps(() => root.api()[name](item.item()))
  }
}

/** The event's dot on the rail. */
@Directive({ selector: "[rindTimelineIndicator]", exportAs: "rindTimelineIndicator" })
export class TimelineIndicator extends ItemPart {
  constructor() {
    super()
    this.wire("indicator")
  }
}

/** The rail between this event and the next. */
@Directive({ selector: "[rindTimelineConnector]", exportAs: "rindTimelineConnector" })
export class TimelineConnector extends ItemPart {
  constructor() {
    super()
    this.wire("connector")
  }
}

@Directive({ selector: "[rindTimelineContent]", exportAs: "rindTimelineContent" })
export class TimelineContent extends ItemPart {
  constructor() {
    super()
    this.wire("content")
  }
}

@Directive({ selector: "[rindTimelineDescription]", exportAs: "rindTimelineDescription" })
export class TimelineDescription extends ItemPart {
  constructor() {
    super()
    this.wire("description")
  }
}

/** The other side of the rail (a date, a note). */
@Directive({ selector: "[rindTimelineOpposite]", exportAs: "rindTimelineOpposite" })
export class TimelineOpposite extends ItemPart {
  constructor() {
    super()
    this.wire("opposite")
  }
}

/** The event's title; the status text ("current", "upcoming") follows its content. */
@Component({
  selector: "[rindTimelineTitle]",
  exportAs: "rindTimelineTitle",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content />@if (statusText()) {<span [rindProps]="statusProps()">{{
      statusText()
    }}</span>}`,
})
export class TimelineTitle {
  /** @internal */
  protected readonly statusText: Signal<string>
  /** @internal */
  protected readonly statusProps: Signal<
    ReturnType<ReturnType<typeof timelineConnect>["statusProps"]>
  >
  constructor() {
    const root = injectTimeline("Title")
    const item = injectItem("Title")
    this.statusText = computed(() => root.api().statusText(item.item()))
    this.statusProps = computed(() => root.api().statusProps())
    bindProps(() => root.api().title(item.item()))
  }
}

/** `<time rindTimelineTime [datetime]="d">`: its content, or the date in the locale's format. */
@Component({
  selector: "[rindTimelineTime]",
  exportAs: "rindTimelineTime",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ formatted() }}</ng-content>",
})
export class TimelineTime {
  /** The machine-readable date. */
  readonly datetime = input.required<Date | string>()
  /** @internal */
  protected readonly formatted: Signal<string>
  constructor() {
    const root = injectTimeline("Time")
    const date = () => {
      const d = this.datetime()
      return typeof d === "string" ? new Date(d) : d
    }
    this.formatted = computed(() =>
      new Intl.DateTimeFormat(root.lang(), { dateStyle: "medium" }).format(date()),
    )
    bindProps(
      () => {
        const d = this.datetime()
        return root.api().time(typeof d === "string" ? d : d.toISOString())
      },
      { owns: ["datetime"] },
    )
  }
}

/** The Timeline's parts, for a standalone component's `imports`. */
export const Timeline = [
  TimelineRoot,
  TimelineItem,
  TimelineIndicator,
  TimelineConnector,
  TimelineContent,
  TimelineTitle,
  TimelineTime,
  TimelineDescription,
  TimelineOpposite,
] as const
