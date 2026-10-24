/** @jsxImportSource solid-js */
// The Scroll Area contract model (React's, real browsers: it needs layout) against the Solid
// parts, and markup parity.
import { scrollAreaContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { ScrollArea, type ScrollAreaRootProps } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const NOTES = Array.from({ length: 40 }, (_, i) => `Note ${i + 1}`)
const example = (p: Record<string, unknown> = {}, both = false): JSX.Element => (
  <div id="app">
    <ScrollArea.Root {...(p as ScrollAreaRootProps)} style={{ width: "200px", height: "200px" }}>
      <ScrollArea.Viewport aria-label="Notes" style={{ width: "100%", height: "100%" }}>
        <ScrollArea.Content>
          <For each={NOTES}>{(text) => <p style={{ margin: "0", height: "20px" }}>{text}</p>}</For>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar style={{ width: "10px", display: "flex", "flex-direction": "column" }}>
        <ScrollArea.Thumb style={{ height: "var(--rind-scroll-area-thumb-size)" }} />
      </ScrollArea.Scrollbar>
      {both ? (
        <>
          <ScrollArea.Scrollbar orientation="horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </>
      ) : null}
    </ScrollArea.Root>
  </div>
)
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

describe.skipIf(inJsdom)("solid scroll-area model", () => {
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

describe("Solid Scroll Area matches React", () => {
  it("one and two scrollbars, each type", async () => {
    for (const [p, both] of [
      [{}, false],
      [{ type: "always" }, true],
      [{ type: "scroll" }, false],
    ] as const) {
      await clientParity(reactExample(p, both), () => example(p, both))
    }
  })
})
