import { NgTemplateOutlet } from "@angular/common"
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  Renderer2,
  type Signal,
  signal,
  TemplateRef,
  untracked,
  ViewContainerRef,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type CodeBlockCopyDetails,
  type CodeBlockCopyState,
  type CodeBlockEvent,
  type CodeBlockMessages,
  type CodeGrammar,
  type CodeLanguage,
  type CodeTokenType,
  clipboardCapability,
  codeBlockConnect,
  codeBlockMachine,
  codeBlockMessages,
  codeBlockTokens,
  type LineRanges,
  lineRuns,
  type MessageOverrides,
  type OverflowWatch,
  type PartProps,
  parseRanges,
  partId,
  splitLines,
  type TrustedCodeHtml,
  watchOverflow,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality, injectPress } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { RindProps } from "../rind-props"
import { VisuallyHidden } from "../visually-hidden/visually-hidden"

/** One highlighted token, rendered as text (never HTML). */
export interface CodeToken {
  readonly text: string
  /** Rendered as `data-token`, coloured by the theme's `--rind-code-token-<type>`. */
  readonly token?: CodeTokenType
  readonly className?: string
  readonly style?: string | Readonly<Record<string, string | number>>
}

/** What a Content's line template and `rindCodeBlockLine` receive for each source line. */
export interface CodeBlockLine {
  /** 0-based position in the source. */
  readonly index: number
  /** The line's number (`startLineNumber` + index). */
  readonly number: number
  /** The line's source text. */
  readonly text: string
  readonly highlighted: boolean
}

/** The block's state, for the template (`#b="rindCodeBlockRoot"`, `b.state()`). */
export interface CodeBlockRenderState {
  readonly copyState: CodeBlockCopyState
  readonly wrapped: boolean
  readonly expanded: boolean
  readonly collapsible: boolean
  readonly scrollable: boolean
}

const CODE_BLOCK = new InjectionToken<CodeBlockRoot>("rind-ui.code-block")

function injectCodeBlock(part: string): CodeBlockRoot {
  const root = inject(CODE_BLOCK, { optional: true })
  if (!root) throw new Error(`rindCodeBlock${part} must be inside rindCodeBlockRoot`)
  return root
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * Source code with copy, wrap and collapse: `<div rindCodeBlockRoot [code]="src" language="ts">`
 * with a Header (Title and the triggers) and `<pre rindCodeBlockContent>`.
 */
@Directive({
  selector: "[rindCodeBlockRoot]",
  exportAs: "rindCodeBlockRoot",
  providers: [{ provide: CODE_BLOCK, useExisting: forwardRef(() => CodeBlockRoot) }],
})
export class CodeBlockRoot {
  /** The source: rendered when no highlight is given, and what Copy writes. */
  readonly code = input.required<string>()
  /**
   * Built-in highlighting: a built-in language name (any case) or your own `CodeGrammar`. An
   * unknown name renders plain. `lines` and `html` win over it. A custom grammar must be
   * module-level: the tokens are memoized on its identity.
   */
  readonly language = input<CodeLanguage | (string & {}) | CodeGrammar>()
  /** Your highlighter's tokens, one list per source line, rendered as text. */
  readonly lines = input<readonly (readonly CodeToken[])[]>()
  /** Highlighter output from `trustedCodeHtml()`, injected per line. Never user input. */
  readonly html = input<TrustedCodeHtml>()
  readonly lineNumbers = input(false, { transform: booleanAttribute })
  readonly startLineNumber = input(1)
  readonly highlightLines = input<LineRanges>()
  /** Blocks longer than this start collapsed to it. */
  readonly maxLines = input<number>()
  /** Controlled wrapping (`[(wrapped)]`). */
  readonly wrapped = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultWrapped = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Controlled expansion (`[(expanded)]`). */
  readonly expanded = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultExpanded = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** How long `copied` / `error` last (ms). Default 2000. */
  readonly copyFeedbackDuration = input<number>()
  readonly messages = input<MessageOverrides<CodeBlockMessages>>()
  /** Default: the provider's locale (the announcement's language). */
  readonly locale = input<string>()
  readonly id = input<string>()
  readonly wrappedChangeDetails = output<ChangeEvent<boolean, CodeBlockEvent>>()
  readonly wrappedChange = output<boolean>()
  readonly expandedChangeDetails = output<ChangeEvent<boolean, CodeBlockEvent>>()
  readonly expandedChange = output<boolean>()
  /** Once per copy result (not `copy`: the native copy event would reach that listener too). */
  readonly copyResult = output<CodeBlockCopyDetails>()

  private readonly onWrapped = changeEmitter<boolean, CodeBlockEvent>(
    this.wrappedChangeDetails,
    this.wrappedChange,
  )
  private readonly onExpanded = changeEmitter<boolean, CodeBlockEvent>(
    this.expandedChangeDetails,
    this.expandedChange,
  )
  /** @internal */
  readonly api: Signal<ReturnType<typeof codeBlockConnect>>
  /** @internal */
  readonly send: (event: CodeBlockEvent) => void
  /** @internal */
  readonly sourceLines: Signal<readonly CodeBlockLine[]>
  /** @internal */
  readonly tokens: Signal<ReturnType<typeof codeBlockTokens>>
  /** @internal */
  readonly copyAnchor: { value: Element | null } = { value: null }
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"title">>
  /** @internal */
  readonly titleId: () => string
  /** @internal */
  readonly instance: () => string
  readonly state: Signal<CodeBlockRenderState>

  constructor() {
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const env = injectEnvironment(announcerCapability, clipboardCapability)
    const messages = injectMessages("code-block", codeBlockMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    this.registry = injectPartRegistry<"title">(() => ({ scope: "code-block", root: instance() }))
    const copyAnchor = this.copyAnchor
    const source = computed(() => splitLines(this.code()))
    const collapsible = computed(() => {
      const max = this.maxLines()
      return max !== undefined && source().length > max
    })
    const { view, send } = injectMachine(
      codeBlockMachine,
      () => ({
        code: this.code(),
        messages: messages(),
        id: instance(),
        lang: locale().locale,
        copyFeedbackDuration: this.copyFeedbackDuration(),
        onCopy: (d: CodeBlockCopyDetails) => this.copyResult.emit(d),
        getCopyAnchor: () => (copyAnchor.value instanceof HTMLElement ? copyAnchor.value : null),
        collapsible: collapsible(),
        wrapped: this.wrapped(),
        defaultWrapped: this.defaultWrapped(),
        onWrappedChange: this.onWrapped,
        expanded: this.expanded(),
        defaultExpanded: this.defaultExpanded() ?? !collapsible(),
        onExpandedChange: this.onExpanded,
      }),
      env,
    )
    this.send = send
    // Keyed on the grammar's identity: a grammar object made in a template re-lexes each time.
    this.tokens = computed(() =>
      codeBlockTokens({
        code: this.code(),
        language: this.language(),
        lines: this.lines(),
        html: this.html(),
      }),
    )
    const highlighted = computed(() => parseRanges(this.highlightLines()))
    this.sourceLines = computed(() =>
      source().map((text, index) => {
        const number = this.startLineNumber() + index
        return { index, number, text, highlighted: highlighted().has(number) }
      }),
    )
    const titleId = injectRenderedId(this.registry, "title")
    this.titleId = () => partId("code-block", instance(), "title")
    this.state = computed(() => ({
      copyState: view().state,
      wrapped: view().values.wrapped,
      expanded: view().values.expanded,
      collapsible: collapsible(),
      scrollable: view().context.scrollable,
    }))
    this.api = computed(() =>
      codeBlockConnect(
        {
          instance: instance(),
          ...this.state(),
          lineNumbers: this.lineNumbers(),
          startLineNumber: this.startLineNumber(),
          maxLines: collapsible() ? this.maxLines() : undefined,
          highlighted: highlighted(),
          highlightRuns: lineRuns(highlighted()),
          messages: messages(),
          titleId: titleId(),
          contentId: partId("code-block", instance(), "content"),
          descriptionId: partId("code-block", instance(), "description"),
        },
        env,
      ),
    )
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "code",
          "copyfeedbackduration",
          "defaultexpanded",
          "defaultwrapped",
          "expanded",
          "highlightlines",
          "html",
          "id",
          "language",
          "linenumbers",
          "lines",
          "locale",
          "maxlines",
          "messages",
          "startlinenumber",
          "wrapped",
        ],
      },
    )
  }
}

@Directive({ selector: "[rindCodeBlockHeader]", exportAs: "rindCodeBlockHeader" })
export class CodeBlockHeader {
  constructor() {
    const root = injectCodeBlock("Header")
    bindProps(() => root.api().header())
  }
}

/** The file name or language: the code region's name. */
@Directive({ selector: "[rindCodeBlockTitle]", exportAs: "rindCodeBlockTitle" })
export class CodeBlockTitle {
  readonly id = input<string>()
  constructor() {
    const root = injectCodeBlock("Title")
    const own = () => this.id() ?? root.titleId()
    injectRegisterPart(root.registry, "title", own)
    bindProps(() => root.api().title(own()), { owns: ["id"] })
  }
}

type TriggerKind = "copyTrigger" | "wrapTrigger" | "collapseTrigger"

/** Copy, Wrap and Collapse: buttons named by the messages unless they have content. */
@Directive()
abstract class CodeBlockTriggerBase {
  protected wire(kind: TriggerKind, label: string, onPress: (root: CodeBlockRoot) => void) {
    const root = injectCodeBlock(label)
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    if (kind === "copyTrigger") root.copyAnchor.value = el
    const press = injectPress({
      env,
      send: (e) => {
        if (e.type === "PRESS") onPress(root)
      },
    })
    // Tracks the modality from the first render, so the first keyboard focus is visible.
    if (inject(PLATFORM_ID) === "browser") {
      const destroy = inject(DestroyRef)
      afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    }
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    bindProps(() => {
      // Content (text or an icon) names it; an empty trigger takes the message.
      const named = el.childNodes.length > 0
      return {
        ...root.api()[kind]({ tag, named, focused: focused(), modality: modality() }),
        ...press.props,
        onFocusIn: () => focused.set(true),
        onFocusOut: () => focused.set(false),
      }
    })
  }
}

@Directive({ selector: "[rindCodeBlockCopyTrigger]", exportAs: "rindCodeBlockCopyTrigger" })
export class CodeBlockCopyTrigger extends CodeBlockTriggerBase {
  constructor() {
    super()
    this.wire("copyTrigger", "CopyTrigger", (root) => root.send({ type: "COPY" }))
  }
}

@Directive({ selector: "[rindCodeBlockWrapTrigger]", exportAs: "rindCodeBlockWrapTrigger" })
export class CodeBlockWrapTrigger extends CodeBlockTriggerBase {
  constructor() {
    super()
    this.wire("wrapTrigger", "WrapTrigger", (root) => root.send({ type: "WRAP.TOGGLE" }))
  }
}

@Directive({
  selector: "[rindCodeBlockCollapseTrigger]",
  exportAs: "rindCodeBlockCollapseTrigger",
})
export class CodeBlockCollapseTrigger extends CodeBlockTriggerBase {
  constructor() {
    super()
    this.wire("collapseTrigger", "CollapseTrigger", (root) => root.send({ type: "EXPAND.TOGGLE" }))
  }
}

/**
 * One source line: `<span rindCodeBlockLine [line]="line">` (the default the Content renders);
 * its content, else the trusted HTML, the tokens or the text.
 */
@Component({
  selector: "[rindCodeBlockLine]",
  exportAs: "rindCodeBlockLine",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content
    >@if (!html()) {@if (tokens(); as list) {@for (t of list; track $index) {@if (plain(t)) {{{
            t.text
          }}} @else {<span [rindProps]="tokenProps(t)" [class]="t.className" [style]="t.style">{{
              t.text
            }}</span>}}} @else {{{ line().text }}}}</ng-content
  >`,
})
export class CodeBlockLinePart {
  /** The line to render: one entry of the Root's lines (number, text and token spans). */
  readonly line = input.required<CodeBlockLine>()
  /** @internal */
  protected readonly html: Signal<string | undefined>
  /** @internal */
  protected readonly tokens: Signal<readonly CodeToken[] | undefined>
  /** @internal */
  protected readonly tokenProps: (t: CodeToken) => PartProps
  /** @internal Plain text is not wrapped: fewer nodes on long blocks. */
  protected readonly plain = (t: CodeToken) =>
    t.token === undefined && t.className === undefined && t.style === undefined

  constructor() {
    const root = injectCodeBlock("Line")
    const el: Element = inject(ElementRef).nativeElement
    const renderer = inject(Renderer2)
    this.html = computed(() => root.html()?.lines[this.line().index])
    this.tokens = computed(
      () => root.tokens()?.[this.line().index] as readonly CodeToken[] | undefined,
    )
    this.tokenProps = (t) => (t.token === undefined ? {} : root.api().token(t.token))
    bindProps(() => root.api().line(this.line().number), { owns: ["line"] })
    // Trusted highlighter HTML (`trustedCodeHtml()`): written as is, never sanitized away.
    effect(() => {
      const html = this.html()
      if (html !== undefined) renderer.setProperty(el, "innerHTML", html)
    })
  }
}

/**
 * The code: `<pre rindCodeBlockContent>`, rendering a `<code>` of lines (a `<ng-template
 * let-line>` inside renders each one instead) and the visually hidden description after it.
 */
@Component({
  selector: "[rindCodeBlockContent]",
  exportAs: "rindCodeBlockContent",
  imports: [RindProps, NgTemplateOutlet, CodeBlockLinePart],
  encapsulation: ViewEncapsulation.None,
  template: `<code [rindProps]="codeProps()"
    >@for (line of lines(); track line.index) {@if (line.index > 0) {{{ newline }}}@if (
        lineTemplate(); as t
      ) {<ng-container *ngTemplateOutlet="t; context: { $implicit: line }" />} @else {<span
          rindCodeBlockLine
          [line]="line"
        ></span>}}</code
  >`,
})
export class CodeBlockContent {
  /** @internal */
  protected readonly lines: Signal<readonly CodeBlockLine[]>
  /** @internal */
  protected readonly codeProps: Signal<PartProps>
  /** @internal */
  protected readonly newline = "\n"
  /** @internal */
  protected readonly lineTemplate = contentChild(TemplateRef)

  constructor() {
    const root = injectCodeBlock("Content")
    const el: Element = inject(ElementRef).nativeElement
    this.lines = root.sourceLines
    this.codeProps = computed(() => root.api().code())
    bindProps(() => root.api().content())
    // The description (a collapsed block's hidden lines): the next sibling, as React renders it.
    inject(ViewContainerRef).createComponent(CodeBlockDescription)
    if (inject(PLATFORM_ID) !== "browser") return
    let overflow: OverflowWatch | null = null
    afterNextRender(() => {
      if (!(el instanceof HTMLElement)) return
      overflow = watchOverflow(el, (o) => root.send({ type: "OVERFLOW.CHANGE", overflow: o }))
    })
    // Wrap, expansion and the code change the content's layout: measure again after the render.
    afterRenderEffect(() => {
      root.state().wrapped
      root.state().expanded
      root.sourceLines()
      untracked(() => overflow?.remeasure())
    })
    inject(DestroyRef).onDestroy(() => {
      overflow?.stop()
      overflow = null
    })
  }
}

/** The visually hidden description a Content renders after itself (absent without text). */
@Component({
  selector: "span[rindCodeBlockDescription]",
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [VisuallyHidden],
  template: "{{ text() }}",
})
export class CodeBlockDescription {
  /** @internal */
  protected readonly text: Signal<string | undefined>
  constructor() {
    const root = injectCodeBlock("Content")
    this.text = computed(() => root.api().descriptionText)
    bindProps(() =>
      this.text() ? root.api().description() : absentProps("code-block", root.instance()),
    )
  }
}

/** The Code Block's parts, for a standalone component's `imports`. */
export const CodeBlock = [
  CodeBlockRoot,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockCopyTrigger,
  CodeBlockWrapTrigger,
  CodeBlockCollapseTrigger,
  CodeBlockContent,
  CodeBlockLinePart,
] as const
