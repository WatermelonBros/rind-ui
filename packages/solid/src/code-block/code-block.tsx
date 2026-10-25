/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type ChangeDetails,
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
  parseRanges,
  partId,
  splitLines,
  type TrustedCodeHtml,
  watchOverflow,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  children as resolve,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"
import { VisuallyHidden } from "../visually-hidden"

declare module "../provider" {
  interface RindMessageScopes {
    "code-block": CodeBlockMessages
  }
}

/** One highlighted token, rendered as text (never HTML). */
export interface CodeToken {
  readonly text: string
  /** Rendered as `data-token`, coloured by the theme's `--rind-code-token-<type>`. */
  readonly token?: CodeTokenType
  readonly class?: string
  readonly style?: JSX.CSSProperties
}

/** What `Content`'s `children(line)` and `Line` receive for each source line. */
export interface CodeBlockLine {
  /** 0-based position in the source. */
  readonly index: number
  /** The line's number (`startLineNumber` + index). */
  readonly number: number
  /** The line's source text. */
  readonly text: string
  readonly highlighted: boolean
}

/** What every part's `render` receives. */
export interface CodeBlockRenderState {
  readonly copyState: CodeBlockCopyState
  readonly wrapped: boolean
  readonly expanded: boolean
  readonly collapsible: boolean
  readonly scrollable: boolean
}

type Api = ReturnType<typeof codeBlockConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly send: (event: CodeBlockEvent) => void
  readonly state: CodeBlockRenderState
  readonly wrapped: Accessor<boolean>
  readonly expanded: Accessor<boolean>
  readonly lines: Accessor<readonly CodeBlockLine[]>
  readonly tokens: Accessor<readonly (readonly CodeToken[])[] | undefined>
  readonly html: Accessor<TrustedCodeHtml | undefined>
  readonly setCopyAnchor: (el: Element | null) => void
  readonly registry: PartRegistry<"title">
  readonly titleId: Accessor<string>
}
const CodeBlockContext = createContext<Ctx>()
function useCodeBlock(part: string): Ctx {
  const ctx = useContext(CodeBlockContext)
  if (!ctx) throw new Error(`CodeBlock.${part} must be inside CodeBlock.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<CodeBlockRenderState> | undefined
  readonly children?: JSX.Element | ((state: CodeBlockRenderState) => JSX.Element)
}

export type CodeBlockRootProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** The source: rendered when no highlight is given, and what Copy writes. */
  readonly code: string
  /**
   * Built-in highlighting: a built-in language name (any case) or your own `CodeGrammar`. An
   * unknown name renders plain. `lines` and `html` win over it. A custom grammar must be
   * module-level or memoized: the tokens are memoized on its identity.
   */
  readonly language?: CodeLanguage | (string & {}) | CodeGrammar | undefined
  /** Your highlighter's tokens, one list per source line, rendered as text. */
  readonly lines?: readonly (readonly CodeToken[])[] | undefined
  /** Highlighter output from `trustedCodeHtml()`, injected per line. Never user input. */
  readonly html?: TrustedCodeHtml | undefined
  readonly lineNumbers?: boolean | undefined
  readonly startLineNumber?: number | undefined
  readonly highlightLines?: LineRanges | undefined
  /** Blocks longer than this start collapsed to it. */
  readonly maxLines?: number | undefined
  readonly wrapped?: boolean | undefined
  readonly defaultWrapped?: boolean | undefined
  readonly onWrappedChange?:
    | ((wrapped: boolean, details: ChangeDetails<CodeBlockEvent>) => void)
    | undefined
  readonly expanded?: boolean | undefined
  readonly defaultExpanded?: boolean | undefined
  readonly onExpandedChange?:
    | ((expanded: boolean, details: ChangeDetails<CodeBlockEvent>) => void)
    | undefined
  /** How long `copied` / `error` last (ms). Default 2000. */
  readonly copyFeedbackDuration?: number | undefined
  readonly onCopy?: ((details: CodeBlockCopyDetails) => void) | undefined
  readonly messages?: MessageOverrides<CodeBlockMessages> | undefined
  /** Default: the provider's locale (the announcement's language). */
  readonly locale?: string | undefined
}

function Root(props: CodeBlockRootProps) {
  const [own, rest] = splitProps(props, [
    "code",
    "language",
    "lines",
    "html",
    "lineNumbers",
    "startLineNumber",
    "highlightLines",
    "maxLines",
    "wrapped",
    "defaultWrapped",
    "onWrappedChange",
    "expanded",
    "defaultExpanded",
    "onExpandedChange",
    "copyFeedbackDuration",
    "onCopy",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment(announcerCapability, clipboardCapability)
  const messages = useMessages("code-block", codeBlockMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const registry = usePartRegistry<"title">({ scope: "code-block", root: instance() })
  let copyAnchor: Element | null = null
  const source = createMemo(() => splitLines(own.code))
  const collapsible = createMemo(() => own.maxLines !== undefined && source().length > own.maxLines)
  const { view, send } = useMachine(
    codeBlockMachine,
    () => ({
      code: own.code,
      messages: messages(),
      id: instance(),
      lang: locale().locale,
      copyFeedbackDuration: own.copyFeedbackDuration,
      onCopy: (d: CodeBlockCopyDetails) => own.onCopy?.(d),
      getCopyAnchor: () => (copyAnchor instanceof HTMLElement ? copyAnchor : null),
      collapsible: collapsible(),
      wrapped: own.wrapped,
      defaultWrapped: own.defaultWrapped,
      onWrappedChange: (w: boolean, d: ChangeDetails<CodeBlockEvent>) =>
        own.onWrappedChange?.(w, d),
      expanded: own.expanded,
      defaultExpanded: own.defaultExpanded ?? !collapsible(),
      onExpandedChange: (x: boolean, d: ChangeDetails<CodeBlockEvent>) =>
        own.onExpandedChange?.(x, d),
    }),
    env,
  )
  // Keyed on the grammar's identity: a grammar object made in render re-lexes on every render.
  const tokens = createMemo(
    () =>
      codeBlockTokens({
        code: own.code,
        language: own.language,
        lines: own.lines,
        html: own.html,
      }) as readonly (readonly CodeToken[])[] | undefined,
  )
  const startLineNumber = () => own.startLineNumber ?? 1
  const highlighted = createMemo(() => parseRanges(own.highlightLines))
  const lines = createMemo(() =>
    source().map((text, index) => {
      const number = startLineNumber() + index
      return { index, number, text, highlighted: highlighted().has(number) }
    }),
  )
  const titleId = useRenderedId(registry, "title")
  const wrapped = createMemo(() => view().values.wrapped)
  const expanded = createMemo(() => view().values.expanded)
  const stateValue = () => ({
    copyState: view().state as CodeBlockCopyState,
    wrapped: wrapped(),
    expanded: expanded(),
    collapsible: collapsible(),
    scrollable: view().context.scrollable,
  })
  const state = reactive<CodeBlockRenderState>(stateValue)
  const api = createMemo(() =>
    codeBlockConnect(
      {
        instance: instance(),
        ...stateValue(),
        lineNumbers: own.lineNumbers === true,
        startLineNumber: startLineNumber(),
        maxLines: collapsible() ? own.maxLines : undefined,
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
  const ctx: Ctx = {
    api,
    send,
    state,
    wrapped,
    expanded,
    lines,
    tokens,
    html: () => own.html,
    setCopyAnchor: (el) => {
      copyAnchor = el
    },
    registry,
    titleId: () => partId("code-block", instance(), "title"),
  }
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(rest.id === undefined ? {} : { id: rest.id }) },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <CodeBlockContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </CodeBlockContext.Provider>
  )
}

export type CodeBlockHeaderProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Header(props: CodeBlockHeaderProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCodeBlock("Header")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().header()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type CodeBlockTitleProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function Title(props: CodeBlockTitleProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCodeBlock("Title")
  const own = () => rest.id ?? ctx.titleId()
  useRegisterPart(ctx.registry, "title", own)
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().title(own())), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type CodeBlockTriggerProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

type TriggerKind = "copyTrigger" | "wrapTrigger" | "collapseTrigger"

function trigger(kind: TriggerKind, label: string, onPress: (ctx: Ctx) => void) {
  return function Trigger(props: CodeBlockTriggerProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useCodeBlock(label)
    const env = useEnvironment()
    const [el, setEl] = createSignal<Element | null>(null)
    // The rendered tag: the element's own once mounted when `render` substitutes it.
    const [measured, setMeasured] = createSignal<string | undefined>()
    afterMount(() => {
      const node = el()
      if (local.render && node) setMeasured(node.tagName.toLowerCase())
    })
    const tag = () => (local.render ? (measured() ?? "button") : "button")
    const press = usePress({
      env,
      send: (e) => {
        if (e.type === "PRESS") onPress(ctx)
      },
    })
    // Tracks the modality from mount, so the first keyboard focus is already visible.
    afterMount(() => onCleanup(env.modality.subscribe(() => {})))
    const [focused, setFocused] = createSignal(false)
    const modality = useModality(env.modality, focused)
    const content = resolve(() => resolveChildren(local.children, ctx.state))
    const named = () => {
      const c = content()
      return c !== undefined && c !== null && c !== false
    }
    const merged = createMemo(() =>
      mergeProps(
        {
          ...joinHandlers(
            normalizeProps(
              ctx.api()[kind]({
                tag: tag(),
                named: named(),
                focused: focused(),
                modality: modality(),
              }),
            ),
            press.props,
            { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) },
          ),
          ref: (node: Element) => {
            setEl(node)
            if (kind === "copyTrigger") ctx.setCopyAnchor(node)
          },
        },
        rest,
      ),
    )
    return renderPart(local.render, merged, ctx.state, content, (p) => (
      <button {...p}>{content()}</button>
    ))
  }
}

const CopyTrigger = trigger("copyTrigger", "CopyTrigger", (ctx) => ctx.send({ type: "COPY" }))
const WrapTrigger = trigger("wrapTrigger", "WrapTrigger", (ctx) =>
  ctx.send({ type: "WRAP.TOGGLE" }),
)
const CollapseTrigger = trigger("collapseTrigger", "CollapseTrigger", (ctx) =>
  ctx.send({ type: "EXPAND.TOGGLE" }),
)

export type CodeBlockLineProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>> & {
  /** The line to render: one entry of the tokens from `Root` (number, text and token spans). */
  readonly line: CodeBlockLine
}

function Line(props: CodeBlockLineProps) {
  const [local, rest] = splitProps(props, ["line", "render", "children"])
  const ctx = useCodeBlock("Line")
  const own = resolve(() => resolveChildren(local.children, ctx.state))
  const html = () => ctx.html()?.lines[local.line.index]
  const isHtml = () => own() === undefined && html() !== undefined
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().line(local.line.number)), rest),
  )
  const children = (): JSX.Element => {
    const given = own()
    if (given !== undefined) return given
    const tokens = ctx.tokens()?.[local.line.index]
    if (!tokens) return local.line.text
    return (
      <For each={tokens}>
        {(t) =>
          // Plain text is not wrapped: fewer nodes on long blocks.
          t.token === undefined && t.class === undefined && t.style === undefined ? (
            t.text
          ) : (
            <span
              {...(t.token === undefined ? {} : normalizeProps(ctx.api().token(t.token)))}
              class={t.class}
              style={t.style}
            >
              {t.text}
            </span>
          )
        }
      </For>
    )
  }
  const withHtml = createMemo(() => (isHtml() ? { ...merged(), innerHTML: html() } : merged()))
  return renderPart(local.render, withHtml, ctx.state, children, (p) => (
    <Show when={isHtml()} fallback={<span {...p}>{children()}</span>}>
      <span {...p} />
    </Show>
  ))
}

export type CodeBlockContentProps = Omit<
  PartProps<JSX.HTMLAttributes<HTMLPreElement>>,
  "children"
> & {
  /** Renders each line (default `<CodeBlock.Line line={line} />`). */
  readonly children?: ((line: CodeBlockLine) => JSX.Element) | undefined
}

function Content(props: CodeBlockContentProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCodeBlock("Content")
  const [el, setEl] = createSignal<Element | null>(null)
  afterMount(() => {
    const node = el()
    if (!(node instanceof HTMLElement)) return
    const watch: OverflowWatch = watchOverflow(node, (overflow) =>
      ctx.send({ type: "OVERFLOW.CHANGE", overflow }),
    )
    // Wrap, expansion and the code change the content's layout: measure again after commit.
    createEffect(() => {
      ctx.wrapped()
      ctx.expanded()
      ctx.lines()
      watch.remeasure()
    })
    onCleanup(() => watch.stop())
  })
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().content()), ref: setEl }, rest),
  )
  const body = () => (
    <code {...normalizeProps(ctx.api().code())}>
      <For each={ctx.lines()}>
        {(line) => (
          <>
            {line.index > 0 ? "\n" : null}
            {local.children ? local.children(line) : <Line line={line} />}
          </>
        )}
      </For>
    </code>
  )
  return (
    <>
      {renderPart(local.render, merged, ctx.state, body, (p) => (
        <pre {...p}>{body()}</pre>
      ))}
      <Show when={ctx.api().descriptionText}>
        {(description) => (
          <VisuallyHidden {...normalizeProps(ctx.api().description())}>
            {description()}
          </VisuallyHidden>
        )}
      </Show>
    </>
  )
}

/** The parts, by name: `code-block.parts.ts` re-exports them as the `CodeBlock` namespace. */
export { CollapseTrigger, Content, CopyTrigger, Header, Line, Root, Title, WrapTrigger }
