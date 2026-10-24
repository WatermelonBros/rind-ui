// The Scroll Area contract model (React's, real browsers: it needs layout) against the Vue
// parts, and markup parity.
import { scrollAreaContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { ScrollArea } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const NOTES = Array.from({ length: 40 }, (_, i) => `Note ${i + 1}`)
const example = (p: Record<string, unknown> = {}, both = false) =>
  h("div", { id: "app" }, [
    h(ScrollArea.Root, { ...p, style: { width: "200px", height: "200px" } }, () => [
      h(
        ScrollArea.Viewport,
        { "aria-label": "Notes", style: { width: "100%", height: "100%" } },
        () =>
          h(ScrollArea.Content, null, () =>
            NOTES.map((text) =>
              h("p", { key: text, style: { margin: "0", height: "20px" } }, text),
            ),
          ),
      ),
      h(
        ScrollArea.Scrollbar,
        { style: { width: "10px", display: "flex", flexDirection: "column" } },
        () => h(ScrollArea.Thumb, { style: { height: "var(--rind-scroll-area-thumb-size)" } }),
      ),
      ...(both
        ? [
            h(ScrollArea.Scrollbar, { orientation: "horizontal" }, () => h(ScrollArea.Thumb)),
            h(ScrollArea.Corner),
          ]
        : []),
    ]),
  ])
const reactExample = (p: Record<string, unknown> = {}, both = false) =>
  r(
    "div",
    { id: "app" },
    r(
      R.ScrollArea.Root,
      { ...p, style: { width: "200px", height: "200px" } } as never,
      r(
        R.ScrollArea.Viewport,
        { "aria-label": "Notes", style: { width: "100%", height: "100%" } },
        r(
          R.ScrollArea.Content,
          null,
          NOTES.map((text) => r("p", { key: text, style: { margin: "0", height: "20px" } }, text)),
        ),
      ),
      r(
        R.ScrollArea.Scrollbar,
        { style: { width: "10px", display: "flex", flexDirection: "column" } },
        r(R.ScrollArea.Thumb, { style: { height: "var(--rind-scroll-area-thumb-size)" } }),
      ),
      both ? r(R.ScrollArea.Scrollbar, { orientation: "horizontal" }, r(R.ScrollArea.Thumb)) : null,
      both ? r(R.ScrollArea.Corner) : null,
    ),
  )
/** Rendered and measured once (the tab stop exists only after the first measure). */
async function measured(type: "hover" | "auto") {
  const m = mount(() => example({ type }))
  await vi.waitFor(() =>
    expect(document.querySelector('[data-part="viewport"][data-overflow-y]')).not.toBeNull(),
  )
  return m
}

describe.skipIf(inJsdom)("vue scroll-area model", () => {
  for (const type of ["hover", "auto"] as const) {
    describe(type, () => {
      testMachine(scrollAreaContract, {
        test: it,
        setup: () => measured(type),
        target: () => screen,
        anchor: [{ name: "Notes" }] as never,
        props: {
          root: "oracle",
          type,
          hideDelay: 600,
          trackPress: undefined,
          onTrack: undefined,
        } as never,
        modalities: ["pointer", "keyboard", "virtual"],
        a11y,
      })
    })
  }
})

describe("Vue Scroll Area matches React", () => {
  it("one and two scrollbars, each type", async () => {
    for (const [p, both] of [
      [{}, false],
      [{ type: "always" }, true],
      [{ type: "scroll" }, false],
    ] as const) {
      await serverParity(reactExample(p, both), () => example(p, both))
      await clientParity(reactExample(p, both), () => example(p, both))
    }
  })
})
