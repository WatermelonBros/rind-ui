"use client"

import { type Clipboard, trustedCodeHtml } from "@rind-ui/core"
import { CodeBlock, type CodeBlockRootProps, RindProvider, Tabs } from "@rind-ui/react"
import hljs from "highlight.js/lib/common"
import type { States, Variants } from "./types"

/**
 * The copy states last while a write settles and for the feedback duration after a press: no
 * static page holds them (the harness lists them as transient). Basic is idle.
 */
export const states: States = { "code-block": { idle: "Basic" } }

const sample = `import { CodeBlock } from "@rind-ui/react"

export function Example({ code }: { code: string }) {
  return (
    <CodeBlock.Root code={code}>
      <CodeBlock.Content />
    </CodeBlock.Root>
  )
}`

function Block({ title, ...props }: CodeBlockRootProps & { readonly title?: string }) {
  return (
    <CodeBlock.Root {...props}>
      <CodeBlock.Header>
        {title ? <CodeBlock.Title>{title}</CodeBlock.Title> : null}
        <CodeBlock.WrapTrigger>Wrap</CodeBlock.WrapTrigger>
        <CodeBlock.CopyTrigger>Copy</CodeBlock.CopyTrigger>
        <CodeBlock.CollapseTrigger>Show all</CodeBlock.CollapseTrigger>
      </CodeBlock.Header>
      <CodeBlock.Content />
    </CodeBlock.Root>
  )
}

export function Basic() {
  return <Block title="example.tsx" code={sample} />
}

export function LineNumbers() {
  return <Block title="example.tsx" code={sample} lineNumbers highlightLines={[1, [5, 7]]} />
}

export function Tokens() {
  const code = 'const greeting = "hello"'
  return (
    <Block
      title="tokens.ts"
      code={code}
      lines={[
        [
          { text: "const", style: { fontWeight: 700 } },
          { text: " greeting = " },
          { text: '"hello"', style: { fontStyle: "italic" } },
        ],
      ]}
    />
  )
}

/** A highlighter adapter: highlight.js output, split per line, marked as trusted. */
export function Highlighted() {
  const html = trustedCodeHtml(hljs.highlight(sample, { language: "typescript" }).value)
  return <Block title="example.tsx" code={sample} html={html} lineNumbers />
}

export function Wrapped() {
  const code = `const message = "${"a long line that keeps going ".repeat(6).trim()}"`
  return <Block title="long.ts" code={code} defaultWrapped />
}

export function Collapsed() {
  const code = Array.from({ length: 30 }, (_, i) => `console.log(${i + 1})`).join("\n")
  return <Block title="log.ts" code={code} maxLines={8} lineNumbers />
}

export function Files() {
  return (
    <Tabs.Root defaultValue="app">
      <Tabs.List aria-label="Files">
        <Tabs.Tab value="app">app.tsx</Tabs.Tab>
        <Tabs.Tab value="css">styles.css</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="app">
        <Block code={sample} />
      </Tabs.Panel>
      <Tabs.Panel value="css">
        <Block code={"[data-scope=code-block] {\n  font-size: 14px;\n}"} />
      </Tabs.Panel>
    </Tabs.Root>
  )
}

export function RightToLeft() {
  return (
    <div dir="rtl" lang="ar">
      <Block title="مثال.ts" code={'const a = "abc"'} />
    </div>
  )
}

const failing: Clipboard = {
  writeText: () => Promise.reject(new Error("Clipboard blocked")),
}

export function CopyFailure() {
  return (
    <RindProvider environment={{ clipboard: failing }}>
      <Block title="blocked.ts" code={'console.log("not copied")'} />
    </RindProvider>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic", description: "Copy, wrap and the title naming the code." },
  LineNumbers: {
    title: "Line numbers and highlighted lines",
    description: "Numbers are a CSS counter, never copied; highlighted lines are described.",
  },
  Tokens: { title: "Tokens", description: "`lines`: token lists rendered as text, never HTML." },
  Highlighted: {
    title: "Highlighter output",
    description: "A highlight.js adapter: `trustedCodeHtml(html)`, split per line.",
  },
  Wrapped: { title: "Wrapped", description: "`defaultWrapped`: the wrap toggle starts pressed." },
  Collapsed: {
    title: "Collapsed",
    description: "`maxLines`: clipped, every line still in the page and copied.",
  },
  Files: { title: "Several files", description: "One block per Tabs panel." },
  RightToLeft: { title: "Right to left", description: 'The code stays `dir="ltr"`.' },
  CopyFailure: {
    title: "Copy failure",
    description: 'A clipboard that rejects: "Copy failed" is announced, never "Copied".',
  },
}
