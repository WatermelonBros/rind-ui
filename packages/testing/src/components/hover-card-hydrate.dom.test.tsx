// Hover Card server markup and hydration: a closed, a `defaultOpen` and a `keepMounted` card
// server-render, hydrate without mismatch warnings, and the trigger keeps its link semantics.
import { HoverCard } from "@rind-ui/react"
import { act, screen } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (props: { defaultOpen?: boolean; keepMounted?: boolean }) => (
  <HoverCard.Root {...props}>
    <HoverCard.Trigger href="/u/jane">Jane Doe</HoverCard.Trigger>
    <HoverCard.Portal>
      <HoverCard.Positioner>
        <HoverCard.Content>
          <p>Designer in Lisbon.</p>
        </HoverCard.Content>
      </HoverCard.Positioner>
    </HoverCard.Portal>
  </HoverCard.Root>
)

describe("HoverCard hydration", () => {
  it.each([{}, { defaultOpen: true }, { keepMounted: true }])(
    "hydrates silently (%o)",
    async (props) => {
      const markup = renderToString(tree(props))
      expect(markup).toContain('href="/u/jane"')
      expect(markup).toContain('aria-haspopup="dialog"')
      const container = document.createElement("div")
      container.innerHTML = markup
      document.body.append(container)
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      let root: ReturnType<typeof hydrateRoot> | undefined
      await act(async () => {
        root = hydrateRoot(container, tree(props), {
          onRecoverableError: (e) => error(String(e)),
        })
      })
      const link = screen.getByRole("link", { name: "Jane Doe" })
      expect(link.getAttribute("aria-expanded")).toBe(props.defaultOpen ? "true" : "false")
      const calls = error.mock.calls.map((c) => String(c[0]).slice(0, 200))
      await act(async () => root?.unmount())
      container.remove()
      expect(calls).toEqual([])
    },
  )
})
