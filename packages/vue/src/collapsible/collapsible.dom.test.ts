// The Collapsible contract model (React's matrix) against the Vue parts, and markup parity.
import { type ClosedContent, collapsibleContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Collapsible, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const base = {
  open: undefined,
  defaultOpen: undefined,
  onOpenChange: undefined,
  disabled: undefined,
  focusOutOfContent: undefined,
}
const anchor = [{ name: "Details" }] as never
type P = Record<string, unknown>
const tree = (p: P) =>
  h(Collapsible.Root, p, () => [
    h(Collapsible.Trigger, null, () => ["Details ", h(Collapsible.Indicator)]),
    h(Collapsible.Content, null, () => h("a", { href: "#more" }, "More")),
  ])
const reactTree = (p: P) =>
  r(
    R.Collapsible.Root,
    p,
    r(R.Collapsible.Trigger, null, "Details ", r(R.Collapsible.Indicator)),
    r(R.Collapsible.Content, null, r("a", { href: "#more" }, "More")),
  )
const ui = (p: P) =>
  h(RindProvider, { environment: { platform: currentRun()?.platform ?? platforms.linux } }, () =>
    tree(p),
  )

for (const closedContent of ["until-found", "hidden", "unmount"] as readonly ClosedContent[]) {
  for (const disabled of [false, true]) {
    for (const defaultOpen of [false, true]) {
      describe(`vue collapsible model: ${closedContent}, disabled ${disabled}, open ${defaultOpen}`, () => {
        testMachine(collapsibleContract, {
          test: it,
          setup: () => mount(() => ui({ closedContent, disabled, defaultOpen })),
          target: () => screen,
          anchor,
          props: { ...base, disabled, defaultOpen } as never,
          a11y,
        })
      })
    }
  }
}

describe("vue collapsible model: controlled ($sync:open)", () => {
  testMachine(collapsibleContract, {
    test: it,
    setup: () => mount((p: P) => ui(p), { open: false }),
    rerender: (next, rendered) => rendered.rerender({ open: (next as { open: boolean }).open }),
    target: () => screen,
    anchor,
    props: { ...base, open: false } as never,
    a11y,
    modalities: ["pointer"],
  })
})

describe("Vue Collapsible matches React", () => {
  it("closed modes, open, disabled", async () => {
    for (const p of [
      {},
      { defaultOpen: true },
      { closedContent: "hidden" },
      { closedContent: "unmount" },
      { disabled: true, focusableWhenDisabled: true },
    ]) {
      await serverParity(reactTree(p), () => tree(p))
      await clientParity(reactTree(p), () => tree(p))
    }
  })
})
