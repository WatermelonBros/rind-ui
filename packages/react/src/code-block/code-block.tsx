import {
  type ChangeDetails,
  type CodeBlockCopyDetails,
  type CodeBlockCopyState,
  type CodeBlockEvent,
  type CodeBlockMessages,
  type CodeGrammar,
  type CodeLanguage,
  type CodeTokenType,
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
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  type PartRegistry,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
} from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"
import { VisuallyHidden } from "../visually-hidden"

declare module "../provider" {
  interface RindMessageScopes {
    "code-block": CodeBlockMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** One highlighted token, rendered as text (never HTML). */
export interface CodeToken {
  readonly text: string
  /** Rendered as `data-token`, coloured by the theme's `--rind-code-token-<type>`. */
  readonly token?: CodeTokenType
  readonly className?: string
  readonly style?: CSSProperties
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
  readonly api: Api
  readonly send: (event: CodeBlockEvent) => void
  readonly state: CodeBlockRenderState
  readonly lines: readonly CodeBlockLine[]
  readonly tokens: readonly (readonly CodeToken[])[] | undefined
  readonly html: TrustedCodeHtml | undefined
  readonly copyAnchor: { current: HTMLElement | null }
  readonly registry: PartRegistry<"title">
  readonly titleId: string
}
const CodeBlockContext = createContext<Ctx | null>(null)
function useCodeBlock(part: string): Ctx {
  const ctx = useContext(CodeBlockContext)
  if (!ctx) throw new Error(`CodeBlock.${part} must be inside CodeBlock.Root`)
  return ctx
}

export type CodeBlockRootProps = ComponentPropsWithRef<"div"> & {
  /** The source: rendered when no highlight is given, and what Copy writes. */
  readonly code: string
  /**
   * Built-in highlighting: a built-in language name (any case) or your own `CodeGrammar`. An
   * unknown name renders plain. `lines` and `html` win over it. A custom grammar must be
   * module-level or memoized: the tokens are memoized on its identity.
   */
  readonly language?: CodeLanguage | (string & {}) | CodeGrammar
  /** Your highlighter's tokens, one list per source line, rendered as text. */
  readonly lines?: readonly (readonly CodeToken[])[]
  /** Highlighter output from `trustedCodeHtml()`, injected per line. Never user input. */
  readonly html?: TrustedCodeHtml
  readonly lineNumbers?: boolean
  readonly startLineNumber?: number
  readonly highlightLines?: LineRanges
  /** Blocks longer than this start collapsed to it. */
  readonly maxLines?: number
  readonly wrapped?: boolean
  readonly defaultWrapped?: boolean
  readonly onWrappedChange?: (wrapped: boolean, details: ChangeDetails<CodeBlockEvent>) => void
  readonly expanded?: boolean
  readonly defaultExpanded?: boolean
  readonly onExpandedChange?: (expanded: boolean, details: ChangeDetails<CodeBlockEvent>) => void
  /** How long `copied` / `error` last (ms). Default 2000. */
  readonly copyFeedbackDuration?: number
  readonly onCopy?: (details: CodeBlockCopyDetails) => void
  readonly messages?: MessageOverrides<CodeBlockMessages>
  /** Default: the provider's locale (the announcement's language). */
  readonly locale?: string
  readonly render?: RenderProp<CodeBlockRenderState>
}

function Root({
  code,
  language,
  lines: ownTokens,
  html,
  lineNumbers = false,
  startLineNumber = 1,
  highlightLines,
  maxLines,
  wrapped,
  defaultWrapped,
  onWrappedChange,
  expanded,
  defaultExpanded,
  onExpandedChange,
  copyFeedbackDuration,
  onCopy,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: CodeBlockRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment()
  const messages = useMessages("code-block", codeBlockMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const registry = usePartRegistry<"title">({ scope: "code-block", root: instance })
  const copyAnchor = useRef<HTMLElement | null>(null)
  const source = useMemo(() => splitLines(code), [code])
  const collapsible = maxLines !== undefined && source.length > maxLines
  const { view, send } = useMachine(codeBlockMachine, {
    code,
    messages,
    id: instance,
    lang: locale,
    copyFeedbackDuration,
    onCopy,
    getCopyAnchor: () => copyAnchor.current,
    collapsible,
    wrapped,
    defaultWrapped,
    onWrappedChange,
    expanded,
    defaultExpanded: defaultExpanded ?? !collapsible,
    onExpandedChange,
  })
  // Keyed on the grammar's identity: a grammar object made in render re-lexes on every render.
  const tokens = useMemo(
    () => codeBlockTokens({ code, language, lines: ownTokens, html }),
    [ownTokens, html, language, code],
  )
  const highlighted = useMemo(() => parseRanges(highlightLines), [highlightLines])
  const lines = useMemo(
    () =>
      source.map((text, index) => {
        const number = startLineNumber + index
        return { index, number, text, highlighted: highlighted.has(number) }
      }),
    [source, startLineNumber, highlighted],
  )
  const titleId = useRenderedId(registry, "title")
  const state: CodeBlockRenderState = {
    copyState: view.state,
    wrapped: view.values.wrapped,
    expanded: view.values.expanded,
    collapsible,
    scrollable: view.context.scrollable,
  }
  const api = codeBlockConnect(
    {
      instance,
      ...state,
      lineNumbers,
      startLineNumber,
      maxLines: collapsible ? maxLines : undefined,
      highlighted,
      highlightRuns: lineRuns(highlighted),
      messages,
      titleId,
      contentId: partId("code-block", instance, "content"),
      descriptionId: partId("code-block", instance, "description"),
    },
    env,
  )
  const ctx: Ctx = {
    api,
    send,
    state,
    lines,
    tokens,
    html,
    copyAnchor,
    registry,
    titleId: partId("code-block", instance, "title"),
  }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  return (
    <CodeBlockContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </CodeBlockContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<CodeBlockRenderState>
}

function Header({ render, ...rest }: PartProps<"div">) {
  const ctx = useCodeBlock("Header")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.header()), rest), render, ctx.state)
}

function Title({ render, id, ...rest }: PartProps<"span">) {
  const ctx = useCodeBlock("Title")
  const own = id ?? ctx.titleId
  useRegisterPart(ctx.registry, "title", own)
  return renderPart("span", mergeProps(normalizeProps(ctx.api.title(own)), rest), render, ctx.state)
}

type TriggerKind = "copyTrigger" | "wrapTrigger" | "collapseTrigger"

function useTrigger(
  kind: TriggerKind,
  label: string,
  onPress: (ctx: Ctx) => void,
  own: PartProps<"button">,
) {
  const ctx = useCodeBlock(label)
  const { render, ref, children, ...rest } = own
  const env = useEnvironment()
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(ctx)
    },
  })
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const named = children !== undefined && children !== null && children !== false
  const api = normalizeProps(ctx.api[kind]({ tag, named, focused, modality }))
  const anchor = kind === "copyTrigger" ? ctx.copyAnchor : null
  const props = mergeProps(
    {
      ...joinHandlers(api, press.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: anchor ? composeRefs(composeRefs(el, anchor), ref) : composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

function CopyTrigger(props: PartProps<"button">) {
  return useTrigger("copyTrigger", "CopyTrigger", (ctx) => ctx.send({ type: "COPY" }), props)
}

function WrapTrigger(props: PartProps<"button">) {
  return useTrigger("wrapTrigger", "WrapTrigger", (ctx) => ctx.send({ type: "WRAP.TOGGLE" }), props)
}

function CollapseTrigger(props: PartProps<"button">) {
  return useTrigger(
    "collapseTrigger",
    "CollapseTrigger",
    (ctx) => ctx.send({ type: "EXPAND.TOGGLE" }),
    props,
  )
}

export type CodeBlockContentProps = Omit<PartProps<"pre">, "children"> & {
  /** Renders each line (default `<CodeBlock.Line line={line} />`). */
  readonly children?: (line: CodeBlockLine) => ReactNode
}

function Content({ render, ref, children, ...rest }: CodeBlockContentProps) {
  const ctx = useCodeBlock("Content")
  const el = useRef<HTMLElement | null>(null)
  const watch = useRef<OverflowWatch | null>(null)
  const send = ctx.send
  useEffect(() => {
    const node = el.current
    if (!node) return
    const w = watchOverflow(node, (overflow) => send({ type: "OVERFLOW.CHANGE", overflow }))
    watch.current = w
    return () => {
      w.stop()
      watch.current = null
    }
  }, [send])
  // Wrap, expansion and the code change the content's layout: measure again after commit.
  const { wrapped, expanded } = ctx.state
  useIsoLayoutEffect(() => {
    watch.current?.remeasure()
  }, [wrapped, expanded, ctx.lines])
  const props = mergeProps(
    { ...normalizeProps(ctx.api.content()), ref: composeRefs(el, ref) },
    rest,
  )
  const body = (
    <code {...normalizeProps(ctx.api.code())}>
      {ctx.lines.map((line) => (
        <Fragment key={line.index}>
          {line.index > 0 ? "\n" : null}
          {children ? children(line) : <Line line={line} />}
        </Fragment>
      ))}
    </code>
  )
  const description = ctx.api.descriptionText
  return (
    <>
      {renderPart("pre", { ...props, children: body }, render, ctx.state)}
      {description ? (
        <VisuallyHidden {...normalizeProps(ctx.api.description())}>{description}</VisuallyHidden>
      ) : null}
    </>
  )
}

export type CodeBlockLineProps = PartProps<"span"> & { readonly line: CodeBlockLine }

function Line({ line, render, children, ...rest }: CodeBlockLineProps) {
  const ctx = useCodeBlock("Line")
  const own = normalizeProps(ctx.api.line(line.number))
  const html = ctx.html?.lines[line.index]
  const tokens = ctx.tokens?.[line.index]
  const content =
    children !== undefined
      ? { children }
      : html !== undefined
        ? { dangerouslySetInnerHTML: { __html: html } }
        : tokens
          ? {
              children: tokens.map((t, i) =>
                // Plain text is not wrapped: fewer nodes on long blocks.
                t.token === undefined && t.className === undefined && t.style === undefined ? (
                  t.text
                ) : (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: tokens have no identity but their place
                    key={i}
                    {...(t.token === undefined ? {} : normalizeProps(ctx.api.token(t.token)))}
                    className={t.className}
                    style={t.style}
                  >
                    {t.text}
                  </span>
                ),
              ),
            }
          : { children: line.text }
  return renderPart("span", { ...mergeProps(own, rest), ...content }, render, ctx.state)
}

export const CodeBlock = {
  Root,
  Header,
  Title,
  CopyTrigger,
  WrapTrigger,
  CollapseTrigger,
  Content,
  Line,
}
