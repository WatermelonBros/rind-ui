// Mentions on the server (Node's server platform: jsdom only): the textarea carries its text as
// content, never a `value` attribute (as React's markup); the Highlighter paints the mention; it
// hydrates in place with the text still in the textarea.
import { Component } from "@angular/core"
import { describe, expect, it } from "vitest"
import { hydrate } from "../../fixtures/hydrate"
import { serverDocument } from "../../fixtures/parity"
import { Mentions } from "./mentions"

@Component({
  selector: "rind-hydrate",
  imports: [Mentions],
  template: `<div
    rindMentionsRoot
    [triggers]="[{ char: '@' }]"
    defaultValue="Hi @Bob "
    [defaultMentions]="[{ id: 'bob', trigger: '@', start: 3, end: 7 }]"
  >
    <div rindMentionsHighlighter></div>
    <textarea rindMentionsTextarea aria-label="Message"></textarea>
  </div>`,
})
class Hydrated {}

describe("angular mentions server render and hydration", () => {
  it("the textarea's text is its content; hydrates in place", async () => {
    const html = await serverDocument(Hydrated)
    const parsed = document.createElement("div")
    parsed.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? ""
    const textarea = parsed.querySelector("textarea") as HTMLTextAreaElement
    expect(textarea.hasAttribute("value")).toBe(false)
    expect(textarea.textContent).toBe("Hi @Bob ")
    expect(parsed.querySelector('[data-part="mention"]')?.textContent).toBe("@Bob")
    const host = await hydrate(Hydrated)
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Hi @Bob ")
  })
})
