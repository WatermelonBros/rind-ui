// Citation (add-citation): a numbered marker that previews its source in a Hover Card. The card's
// open/close, delays and positioning are Hover Card's (a host directive), with `open` = pinned ||
// hover-open; the Citation machine owns `pinned` (a press on a button marker). A link marker
// follows its link.
import { NgTemplateOutlet } from "@angular/common"
import {
  Component,
  computed,
  DestroyRef,
  Directive,
  forwardRef,
  InjectionToken,
  inject,
  input,
  numberAttribute,
  output,
  type Signal,
  signal,
  ViewEncapsulation,
} from "@angular/core"
import {
  type CitationMessages,
  type CitationSource,
  citationConnect,
  citationMachine,
  citationMessages,
  type MessageOverrides,
  type PartProps,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import {
  HOVER_CARD_OVERRIDES,
  HoverCardContent,
  HoverCardPortal,
  HoverCardPositioner,
  HoverCardRoot,
  HoverCardTrigger,
} from "../hover-card/hover-card"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectMessages } from "../provider"
import { RindProps } from "../rind-props"

/** The citation's state, for the template (`#c="rindCitationRoot"`, `c.state()`). */
export interface CitationRenderState {
  readonly open: boolean
  readonly pinned: boolean
  readonly kind: "link" | "button" | "pending"
}

const CITATION = new InjectionToken<CitationRoot>("rind-ui.citation")

function injectCitation(part: string): CitationRoot {
  const root = inject(CITATION, { optional: true })
  if (!root) throw new Error(`rindCitation${part} must be inside rindCitationRoot`)
  return root
}

const CLOSES = new Set(["escape-key", "outside-press", "outside-focus", "parent-dismissed"])

/** The props this Citation imposes on its Hover Card (open, delays, disabled). */
interface Overrides {
  props: () => { open: boolean; openDelay: number; closeDelay: number; disabled: boolean }
}

/**
 * One citation: `<span rindCitationRoot [index]="1" [source]="source">` holding a
 * `<rind-citation-trigger>`, the card (`rindCitationPositioner`, `rindCitationContent`) and the
 * cited text.
 */
@Directive({
  selector: "[rindCitationRoot]",
  exportAs: "rindCitationRoot",
  hostDirectives: [{ directive: HoverCardRoot, inputs: ["positioning"] }],
  providers: [
    { provide: CITATION, useExisting: forwardRef(() => CitationRoot) },
    // A holder the Citation fills once constructed; the Hover Card reads it lazily.
    {
      provide: HOVER_CARD_OVERRIDES,
      useFactory: (): Overrides => ({
        props: () => ({ open: false, openDelay: 300, closeDelay: 200, disabled: true }),
      }),
    },
  ],
})
export class CitationRoot {
  /** The source; absent while it streams (the marker is pending text). */
  readonly source = input<CitationSource>()
  /** Required. The number the marker shows. */
  readonly index = input.required({ transform: numberAttribute })
  /** Where the link opens. Default "_self". */
  readonly target = input<"_self" | "_blank">("_self")
  /** Hover delay before opening (ms). Default 300. */
  readonly openDelay = input(300, { transform: numberAttribute })
  /** Delay before closing (ms). Default 200. */
  readonly closeDelay = input(200, { transform: numberAttribute })
  readonly messages = input<MessageOverrides<CitationMessages>>()
  /** Base for the ids of the card's parts. Default: generated. */
  readonly id = input<string>()
  /** A button marker was pressed. */
  readonly pinnedChange = output<boolean>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof citationConnect>>
  /** @internal */
  readonly press: () => void
  readonly state: Signal<CitationRenderState>

  constructor() {
    const instance = injectRootId(() => this.id())
    const messages = injectMessages("citation", citationMessages, () => this.messages())
    const hoverOpen = signal(false)
    const pending = computed(() => this.source() === undefined)
    const connect = (open: boolean, pinned: boolean) =>
      citationConnect({
        instance: instance(),
        index: this.index(),
        source: this.source(),
        open,
        pinned,
        target: this.target(),
        messages: messages(),
      })
    const { view, send } = injectMachine(
      citationMachine,
      () => ({
        kind: connect(false, false).kind === "link" ? ("link" as const) : ("button" as const),
        onPinnedChange: (p: boolean) => this.pinnedChange.emit(p),
      }),
      {},
    )
    const pinned = computed(() => view().state === "pinned")
    const open = computed(() => !pending() && (pinned() || hoverOpen()))
    // Sound: the factory above creates a mutable holder of this shape.
    const overrides = inject(HOVER_CARD_OVERRIDES) as Overrides
    overrides.props = () => ({
      open: open(),
      openDelay: this.openDelay(),
      closeDelay: this.closeDelay(),
      disabled: pending(),
    })
    const card = inject(HoverCardRoot)
    const sub = card.openChangeDetails.subscribe(({ value, details }) => {
      hoverOpen.set(value)
      // Escape, an outside press or a dismissal closes a pinned card too.
      if (!value && CLOSES.has(details.reason)) send({ type: "UNPIN" })
    })
    inject(DestroyRef).onDestroy(() => sub.unsubscribe())
    this.api = computed(() => connect(hoverOpen(), pinned()))
    this.press = () => send({ type: "PRESS" })
    this.state = computed(() => ({ open: open(), pinned: pinned(), kind: this.api().kind }))
  }
}

const withoutExpanded = (props: PartProps): PartProps => {
  const { "aria-expanded": _expanded, ...rest } = props
  return rest
}

/**
 * The marker: `<rind-citation-trigger />` (its index, or the content given) renders a link for an http(s)
 * source, else a button that pins the card (named "Source 1: title"), or plain text while the
 * source is pending.
 */
@Component({
  selector: "rind-citation-trigger",
  exportAs: "rindCitationTrigger",
  // HoverCardTrigger before RindProps: the Citation's attributes bind after, so its scope wins.
  imports: [NgTemplateOutlet, HoverCardTrigger, RindProps],
  encapsulation: ViewEncapsulation.None,
  host: { style: "display: contents" },
  // No content: the index ("1"), so the marker is never empty.
  template: `<ng-template #c><ng-content>{{ marker() }}</ng-content></ng-template>@switch (kind()) {
      @case ("link") {<a rindHoverCardTrigger [rindProps]="props()"><ng-container *ngTemplateOutlet="c" /></a>}
      @case ("button") {<button rindHoverCardTrigger [rindProps]="props()"><ng-container *ngTemplateOutlet="c" /></button>}
      @default {<span [rindProps]="props()"><ng-container *ngTemplateOutlet="c" /></span>}
    }`,
})
export class CitationTrigger {
  /** @internal */
  protected readonly kind: Signal<"link" | "button" | "pending">
  /** @internal */
  protected readonly props: Signal<PartProps>
  /** @internal */
  protected readonly marker: Signal<string>
  constructor() {
    const root = injectCitation("Trigger")
    this.kind = computed(() => root.api().kind)
    this.marker = computed(() => root.api().markerText)
    this.props = computed(() =>
      // Hover Card owns aria-expanded (from its open: pinned || hover); connect's would override.
      joinHandlers(withoutExpanded(root.api().trigger()), {
        onClick: () => {
          if (root.api().kind === "button") root.press()
        },
      }),
    )
  }
}

/** A part with its attributes and, without content, its text from the source. */
function sourcePart(
  part: string,
  own: (c: CitationRoot) => PartProps,
  text: (c: CitationRoot) => string,
) {
  const root = injectCitation(part)
  bindProps(() => own(root))
  return computed(() => text(root))
}

/** One source. */
@Directive({ selector: "[rindCitationSource]", exportAs: "rindCitationSource" })
export class CitationSourcePart {
  constructor() {
    sourcePart(
      "Source",
      (c) => c.api().source(),
      () => "",
    )
  }
}

/** Its title (its content replaces it). */
@Component({
  selector: "[rindCitationSourceTitle]",
  exportAs: "rindCitationSourceTitle",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class CitationSourceTitle {
  protected readonly text = sourcePart(
    "SourceTitle",
    (c) => c.api().sourceTitle(),
    (c) => c.source()?.title ?? "",
  )
}

/** Its domain. */
@Component({
  selector: "[rindCitationSourceUrl]",
  exportAs: "rindCitationSourceUrl",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class CitationSourceUrl {
  protected readonly text = sourcePart(
    "SourceUrl",
    (c) => c.api().sourceUrl(),
    (c) => c.api().domain ?? "",
  )
}

/** The quoted passage. */
@Component({
  selector: "[rindCitationSourceSnippet]",
  exportAs: "rindCitationSourceSnippet",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class CitationSourceSnippet {
  protected readonly text = sourcePart(
    "SourceSnippet",
    (c) => c.api().sourceSnippet(),
    (c) => c.source()?.snippet ?? "",
  )
}

/** The link to the source: `<a rindCitationSourceLink>`. */
@Component({
  selector: "[rindCitationSourceLink]",
  exportAs: "rindCitationSourceLink",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class CitationSourceLink {
  protected readonly text = sourcePart(
    "SourceLink",
    (c) => c.api().sourceLink(),
    (c) => c.api().href ?? "",
  )
}

/** The words the citation supports (`data-state` follows the card). */
@Directive({ selector: "[rindCitationCitedText]", exportAs: "rindCitationCitedText" })
export class CitationCitedText {
  constructor() {
    sourcePart(
      "CitedText",
      (c) => c.api().citedText(),
      () => "",
    )
  }
}

/**
 * The Citation's parts (and Hover Card's Portal, Positioner and Content), for `imports`. The
 * card goes in `<ng-template rindCitationPortal>`: a citation sits inside a paragraph, and the
 * card (block content) must not.
 */
export const Citation = [
  CitationRoot,
  CitationTrigger,
  HoverCardPortal,
  HoverCardPositioner,
  HoverCardContent,
  CitationSourcePart,
  CitationSourceTitle,
  CitationSourceUrl,
  CitationSourceSnippet,
  CitationSourceLink,
  CitationCitedText,
] as const
