/** @jsxImportSource solid-js */
import { Mentions } from "../../src/mentions"

export function App() {
  return (
    <Mentions.Root
      triggers={[{ char: "@" }]}
      defaultValue="Hi @Bob "
      defaultMentions={[{ id: "bob", trigger: "@", start: 3, end: 7 }]}
    >
      <Mentions.Highlighter />
      <Mentions.Textarea aria-label="Message" />
      <Mentions.Description />
    </Mentions.Root>
  )
}
