"use client"

import { type Clipboard, type CodeGrammar, trustedCodeHtml } from "@rind-ui/core"
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
  return <Block title="example.tsx" code={sample} language="tsx" />
}

export function LineNumbers() {
  return (
    <Block
      title="example.tsx"
      code={sample}
      language="tsx"
      lineNumbers
      highlightLines={[1, [5, 7]]}
    />
  )
}

/** A language of your own: states of ordered rules, coloured by the same token set. */
const ini: CodeGrammar = {
  states: {
    root: [
      { match: /[;#][^\n]*/, token: "comment" },
      { match: /\[/, token: "punctuation", push: "section" },
      { match: /[\w.-]+(?=\s*=)/, token: "property" },
      { match: /=/, token: "operator" },
      { match: /\d+(?![\w.])/, token: "number" },
      { match: /true|false/, token: "keyword" },
      { match: /[^\s;#]+/, token: "string" },
    ],
    section: [
      { match: /\]/, token: "punctuation", pop: true },
      { match: /[^\]\n]+/, token: "type" },
    ],
  },
}

export function Grammar() {
  const code = "; deploy settings\n[server]\nhost = example.org\nport = 8080\ntls = true"
  return <Block title="deploy.ini" code={code} language={ini} />
}

/** A highlighter adapter: highlight.js output, split per line, marked as trusted. */
/** highlight.js scopes onto the token set, so the theme's token colours apply. */
const hljsTokens: Readonly<Record<string, string>> = {
  keyword: "keyword",
  built_in: "keyword",
  literal: "keyword",
  "selector-tag": "keyword",
  string: "string",
  "selector-attr": "string",
  attr: "attr",
  attribute: "attr",
  title: "function",
  name: "tag",
  tag: "tag",
  type: "type",
  number: "number",
  comment: "comment",
  regexp: "regex",
  variable: "variable",
  property: "property",
}

export function Highlighted() {
  const out = hljs.highlight(sample, { language: "typescript" }).value
  // `class="hljs-title function_"` becomes `data-token="function"`; other scopes keep the class.
  const mapped = out.replace(/class="hljs-([\w-]+)[^"]*"/g, (m, scope: string) =>
    hljsTokens[scope] ? `data-token="${hljsTokens[scope]}"` : m,
  )
  const html = trustedCodeHtml(mapped)
  return <Block title="example.tsx" code={sample} html={html} lineNumbers />
}

export function Wrapped() {
  const code = `const message = "${"a long line that keeps going ".repeat(6).trim()}"`
  return <Block title="long.ts" code={code} language="ts" defaultWrapped />
}

export function Collapsed() {
  const code = Array.from({ length: 30 }, (_, i) => `console.log(${i + 1})`).join("\n")
  return <Block title="log.ts" code={code} language="ts" maxLines={8} lineNumbers />
}

export function Files() {
  return (
    <Tabs.Root defaultValue="app">
      <Tabs.List aria-label="Files">
        <Tabs.Tab value="app">app.tsx</Tabs.Tab>
        <Tabs.Tab value="css">styles.css</Tabs.Tab>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Panel value="app">
        <Block code={sample} language="tsx" />
      </Tabs.Panel>
      <Tabs.Panel value="css">
        <Block
          code={"[data-scope=code-block] {\n  --rind-code-token-keyword: #c2185b;\n}"}
          language="css"
        />
      </Tabs.Panel>
    </Tabs.Root>
  )
}

export function RightToLeft() {
  return (
    <div dir="rtl" lang="ar">
      <Block title="مثال.ts" code={'const a = "abc"'} language="ts" />
    </div>
  )
}

const failing: Clipboard = {
  writeText: () => Promise.reject(new Error("Clipboard blocked")),
}

export function CopyFailure() {
  return (
    <RindProvider environment={{ clipboard: failing }}>
      <Block title="blocked.ts" code={'console.log("not copied")'} language="ts" />
    </RindProvider>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: '`language="tsx"`: built-in highlighting, copy, wrap and the title.',
  },
  LineNumbers: {
    title: "Line numbers and highlighted lines",
    description: "Numbers are a CSS counter, never copied; highlighted lines are described.",
  },
  Grammar: {
    title: "Your own language",
    description: "`language={grammar}`: a `CodeGrammar` of states and rules.",
  },
  Highlighted: {
    title: "Highlighter output",
    description: "The escape hatch: highlight.js output through `trustedCodeHtml(html)`.",
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
