// The Hover Card contract model (React's: every mapped transition in pointer, keyboard, touch
// and virtual, on a virtual clock) against the Vue parts, and markup parity.
import { hoverCardContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine, virtualClock } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { HoverCard, RindProvider } from "../index"

// The delays run on a virtual clock: the runner advances it, no real time passes.
const clock = virtualClock()
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
const tree = (p: P, portal = true) => {
  const positioner = () =>
    h(HoverCard.Positioner, null, () =>
      h(HoverCard.Content, null, () => [
        h(HoverCard.Arrow),
        h("p", null, "Designer in Lisbon."),
        h("button", { type: "button" }, "Follow"),
      ]),
    )
  return h("div", { id: "app" }, [
    h("a", { href: "/before" }, "Before"),
    h(HoverCard.Root, { openDelay: 200, closeDelay: 100, ...p }, () => [
      h(HoverCard.Trigger, { href: "/u/jane" }, () => "Jane Doe"),
      portal ? h(HoverCard.Portal, null, positioner) : positioner(),
    ]),
    h("a", { href: "/after" }, "After"),
  ])
}
const reactTree = (p: P, portal = true) => {
  const positioner = r(
    R.HoverCard.Positioner,
    null,
    r(
      R.HoverCard.Content,
      null,
      r(R.HoverCard.Arrow),
      r("p", null, "Designer in Lisbon."),
      r("button", { type: "button" }, "Follow"),
    ),
  )
  return r(
    "div",
    { id: "app" },
    r("a", { href: "/before" }, "Before"),
    r(
      R.HoverCard.Root,
      { openDelay: 200, closeDelay: 100, ...p },
      r(R.HoverCard.Trigger, { href: "/u/jane" }, "Jane Doe"),
      portal ? r(R.HoverCard.Portal, null, positioner) : positioner,
    ),
    r("a", { href: "/after" }, "After"),
  )
}

describe("vue hover card model", () => {
  testMachine(hoverCardContract, {
    test: it,
    setup: () =>
      mount(() => h(RindProvider, { environment: { scheduler: clock.scheduler } }, () => tree({}))),
    target: () => screen,
    anchor: [{ name: "Jane Doe" }] as never,
    // `root` is internal (set by HoverCard.Root); the oracle only needs a value.
    props: {
      open: undefined,
      root: "oracle",
      disabled: undefined,
      openDelay: 200,
      closeDelay: 100,
    } as never,
    modalities: ["pointer", "keyboard", "touch", "virtual"],
    clock,
    a11y,
  })
})

describe("Vue Hover Card matches React", () => {
  it("closed, open, keep mounted", async () => {
    for (const p of [{}, { defaultOpen: true }, { keepMounted: true }] as P[]) {
      await serverParity(reactTree(p), () => tree(p))
      await clientParity(reactTree(p), () => tree(p))
      // In place: the content is inside the compared container.
      await serverParity(reactTree(p, false), () => tree(p, false))
      await clientParity(reactTree(p, false), () => tree(p, false))
    }
  })
})
