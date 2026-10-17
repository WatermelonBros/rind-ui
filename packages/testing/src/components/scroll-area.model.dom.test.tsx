// biome-ignore-all lint/a11y: fixtures deliberately build scrollable regions
// add-scroll-area 6.1: the contract over its mapped transitions, with the scroll area's own
// invariants (tab-stop rule, hidden scrollbars, one dragging axis, no presentational viewport).
// Needs layout (overflow, a tab stop): real browsers only; jsdom measures nothing.
import { scrollAreaContract } from "@rind-ui/core"
import { ScrollArea, type ScrollAreaRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { domEnv, testMachine } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function Example({
  viewportTabIndex,
  ...props
}: ScrollAreaRootProps & { viewportTabIndex?: number }) {
  return (
    <div id="app">
      <ScrollArea.Root {...props} style={{ width: 200, height: 200 }}>
        <ScrollArea.Viewport
          aria-label="Notes"
          style={{ width: "100%", height: "100%" }}
          {...(viewportTabIndex === undefined ? {} : { tabIndex: viewportTabIndex })}
        >
          <ScrollArea.Content>
            {Array.from({ length: 40 }, (_, i) => `Note ${i + 1}`).map((text) => (
              <p key={text} style={{ margin: 0, height: 20 }}>
                {text}
              </p>
            ))}
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar style={{ width: 10, display: "flex", flexDirection: "column" }}>
          <ScrollArea.Thumb style={{ height: "var(--rind-scroll-area-thumb-size)" }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}

/** Rendered and measured once (the tab stop exists only after the first measure). */
async function mount(ui: React.ReactElement) {
  const r = render(ui)
  await vi.waitFor(() =>
    expect(document.querySelector('[data-part="viewport"][data-overflow-y]')).not.toBeNull(),
  )
  return r
}

const oracle = (type: ScrollAreaRootProps["type"]) =>
  ({ root: "oracle", type, hideDelay: 600, trackPress: undefined, onTrack: undefined }) as never

describe.skipIf(inJsdom)("scroll-area model", () => {
  for (const type of ["hover", "auto"] as const) {
    describe(type, () => {
      testMachine(scrollAreaContract, {
        test: it,
        setup: () => mount(<Example type={type} />),
        target: () => screen,
        anchor: [{ name: "Notes" }] as never,
        props: oracle(type),
        modalities: ["pointer", "keyboard", "virtual"],
        a11y,
      })
    })
  }
})

describe.skipIf(inJsdom)("broken wrapper fails with the invariant's name", () => {
  it("tabIndex={-1} on a text-only overflowing Viewport → scroll-area-tab-stop", {
    timeout: 60_000,
  }, async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    testMachine(scrollAreaContract, {
      test: (n, fn) => tests.push({ name: n, fn }),
      setup: () => mount(<Example viewportTabIndex={-1} />),
      target: () => domEnv({ timeout: 500 }),
      anchor: [{ name: "Notes" }] as never,
      props: oracle("hover"),
      modalities: ["pointer"],
    })
    const errors: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => errors.push(e.message))
      document.body.innerHTML = ""
    }
    expect(errors.some((e) => e.includes("scroll-area-tab-stop"))).toBe(true)
  })
})
