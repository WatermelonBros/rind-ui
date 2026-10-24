<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { codeBlockContext } from "./context"
import type { CodeBlockLineProps } from "./types"

const { line, child, children, ...rest }: CodeBlockLineProps = $props()
const ctx = codeBlockContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().line(line.number)), rest)))
const html = $derived(ctx.html()?.lines[line.index])
const tokens = $derived(ctx.tokens()?.[line.index])
const tokenProps = (t: NonNullable<typeof tokens>[number]) => ({
  ...(t.token === undefined ? {} : normalizeProps(ctx.api().token(t.token))),
  ...(t.className === undefined ? {} : { class: t.className }),
  ...(t.style === undefined ? {} : { style: t.style }),
})
</script>

<!-- No whitespace inside: the line is preformatted text. -->
{#if child}{@render child({ props: merged, state: ctx.state() })}{:else if children}<span {...attrs(merged)}
    >{@render children(ctx.state())}</span
  >{:else if html !== undefined}<span {...attrs(merged)}>{@html html}</span>{:else if tokens}<span {...attrs(merged)}
    >{#each tokens as t, i (i)}{#if t.token === undefined && t.className === undefined && t.style === undefined}{t.text}{:else}<span
          {...attrs(tokenProps(t))}>{t.text}</span
        >{/if}{/each}</span
  >{:else}<span {...attrs(merged)}>{line.text}</span>{/if}
