import type {
  ChangeDetails,
  CodeBlockCopyDetails,
  CodeBlockCopyState,
  CodeBlockEvent,
  CodeBlockMessages,
  CodeGrammar,
  CodeLanguage,
  CodeTokenType,
  LineRanges,
  MessageOverrides,
  TrustedCodeHtml,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

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
  readonly className?: string
  readonly style?: string
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
/** What every part's snippets receive. */
export interface CodeBlockRenderState {
  readonly copyState: CodeBlockCopyState
  readonly wrapped: boolean
  readonly expanded: boolean
  readonly collapsible: boolean
  readonly scrollable: boolean
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<CodeBlockRenderState>]> | undefined
  readonly children?: Snippet<[CodeBlockRenderState]> | undefined
}
export type CodeBlockRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The source: rendered when no highlight is given, and what Copy writes. */
  readonly code: string
  /**
   * Built-in highlighting: a built-in language name (any case) or your own `CodeGrammar`. An
   * unknown name renders plain. `lines` and `html` win over it. A custom grammar must be
   * module-level: the tokens are memoized on its identity.
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
  /** Wrapping; `bind:wrapped` controls it. */
  wrapped?: boolean | undefined
  readonly defaultWrapped?: boolean | undefined
  readonly onWrappedChange?:
    | ((wrapped: boolean, details: ChangeDetails<CodeBlockEvent>) => void)
    | undefined
  /** Expansion; `bind:expanded` controls it. */
  expanded?: boolean | undefined
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
export type CodeBlockPartProps = Part<HTMLAttributes<HTMLElement>>
export type CodeBlockTriggerProps = Part<HTMLButtonAttributes>
export type CodeBlockContentProps = Omit<HTMLAttributes<HTMLPreElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<CodeBlockRenderState>]> | undefined
  /** Renders each line (default `<CodeBlock.Line {line} />`). */
  readonly children?: Snippet<[CodeBlockLine]> | undefined
}
export type CodeBlockLineProps = Part<HTMLAttributes<HTMLSpanElement>> & {
  /** The line to render: one entry of the tokens from `Root` (number, text and token spans). */
  readonly line: CodeBlockLine
}
