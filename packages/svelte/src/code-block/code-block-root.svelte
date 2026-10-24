<script lang="ts">
import {
  announcerCapability,
  type ChangeDetails,
  type CodeBlockCopyDetails,
  type CodeBlockEvent,
  clipboardCapability,
  codeBlockConnect,
  codeBlockMachine,
  codeBlockMessages,
  codeBlockTokens,
  lineRuns,
  parseRanges,
  partId,
  splitLines,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { codeBlockContext } from "./context"
import type { CodeBlockRenderState, CodeBlockRootProps } from "./types"

let {
  code,
  language,
  lines: ownTokens,
  html,
  lineNumbers = false,
  startLineNumber = 1,
  highlightLines,
  maxLines,
  wrapped = $bindable(),
  defaultWrapped,
  onWrappedChange,
  expanded = $bindable(),
  defaultExpanded,
  onExpandedChange,
  copyFeedbackDuration,
  onCopy,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: CodeBlockRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability, clipboardCapability)
const messages = useMessages("code-block", codeBlockMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const registry = usePartRegistry<"title">(untrack(() => ({ scope: "code-block", root: instance })))
const copyAnchor: { current: HTMLElement | null } = { current: null }
const source = $derived(splitLines(code))
const collapsible = $derived(maxLines !== undefined && source.length > maxLines)
/** A change event: the consumer's handler first, then the binding unless it cancelled. */
const changer =
  (
    handler: () => ((v: boolean, d: ChangeDetails<CodeBlockEvent>) => void) | undefined,
    write: (v: boolean) => void,
  ) =>
  (next: boolean, details: ChangeDetails<CodeBlockEvent>) => {
    let cancelled = false
    handler()?.(next, {
      ...details,
      cancel: () => {
        cancelled = true
        details.cancel()
      },
    })
    if (!cancelled) write(next)
  }
const machine = useMachine(
  codeBlockMachine,
  () => ({
    code,
    messages: messages(),
    id: instance,
    lang: locale.current.locale,
    copyFeedbackDuration,
    onCopy: (d: CodeBlockCopyDetails) => onCopy?.(d),
    getCopyAnchor: () => copyAnchor.current,
    collapsible,
    wrapped,
    defaultWrapped,
    onWrappedChange: changer(
      () => onWrappedChange,
      (v) => {
        if (wrapped !== undefined) wrapped = v
      },
    ),
    expanded,
    defaultExpanded: defaultExpanded ?? !collapsible,
    onExpandedChange: changer(
      () => onExpandedChange,
      (v) => {
        if (expanded !== undefined) expanded = v
      },
    ),
  }),
  env,
)
// Keyed on the grammar's identity: a grammar object made in render re-lexes on every update.
const tokens = $derived(codeBlockTokens({ code, language, lines: ownTokens, html }))
const highlighted = $derived(parseRanges(highlightLines))
const lines = $derived(
  source.map((text, index) => {
    const number = startLineNumber + index
    return { index, number, text, highlighted: highlighted.has(number) }
  }),
)
const titleId = useRenderedId(registry, "title")
const blockState: CodeBlockRenderState = $derived({
  copyState: machine.view.state,
  wrapped: machine.view.values.wrapped,
  expanded: machine.view.values.expanded,
  collapsible,
  scrollable: machine.view.context.scrollable,
})
const api = $derived(
  codeBlockConnect(
    {
      instance,
      ...blockState,
      lineNumbers,
      startLineNumber,
      maxLines: collapsible ? maxLines : undefined,
      highlighted,
      highlightRuns: lineRuns(highlighted),
      messages: messages(),
      titleId: titleId.current,
      contentId: partId("code-block", instance, "content"),
      descriptionId: partId("code-block", instance, "description"),
    },
    env,
  ),
)
codeBlockContext.set({
  api: () => api,
  send: machine.send,
  state: () => blockState,
  lines: () => lines,
  tokens: () => tokens,
  html: () => html,
  copyAnchor,
  registry,
  titleId: () => partId("code-block", instance, "title"),
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: blockState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(blockState)}</div>
{/if}
