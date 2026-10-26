// Mentions (React) in a real browser: the list is placed at the trigger character (the caret
// rect of the match), not at the textarea's corner; the Highlighter follows the scroll.
import { Mentions, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getMentions } from "../index"

describe("React Mentions placement", () => {
  it("the list opens under the trigger character", async () => {
    render(
      <RindProvider>
        <Mentions.Root triggers={[{ char: "@" }]}>
          <Mentions.Textarea
            aria-label="Message"
            style={{ width: 400, height: 80, font: "16px monospace", padding: 0, border: 0 }}
          />
          <Mentions.Positioner>
            <Mentions.Popup>
              <Mentions.List>
                <Mentions.Item value="ann">Ann</Mentions.Item>
              </Mentions.List>
            </Mentions.Popup>
          </Mentions.Positioner>
        </Mentions.Root>
      </RindProvider>,
    )
    const d = getMentions(document.body)
    await d.type("xxxxxxxxxxxxxxxxxxxx @a")
    const textarea = document.querySelector('[data-part="textarea"]') as HTMLElement
    const positioner = document.querySelector('[data-part="positioner"]') as HTMLElement
    await vi.waitFor(() => {
      const t = textarea.getBoundingClientRect()
      const p = positioner.getBoundingClientRect()
      // 21 monospace characters in: well right of the textarea's left edge.
      expect(p.left - t.left).toBeGreaterThan(150)
      expect(p.top).toBeGreaterThan(t.top)
    })
  })
})
