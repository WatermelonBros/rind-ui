// Heading, Label, Link and Skeleton: the same DOM as @rind-ui/react; Link routing; Skeleton model.
import { skeletonContract, skeletonMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { type ConsumerInvariant, installAnnouncementLog, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import type { Component } from "svelte"
import { describe, expect, it, vi } from "vitest"
import AsChild from "../../fixtures/as-child.svelte"
import Labels from "../../fixtures/heading/labels.svelte"
import Nested from "../../fixtures/heading/nested.svelte"
import Router from "../../fixtures/link/router.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Render from "../../fixtures/render.svelte"
import Card from "../../fixtures/skeleton/card.svelte"
import { Heading, Link } from "../index"

type Props = Record<string, unknown>
const same = (react: Parameters<typeof clientParity>[0], is: unknown, props: Props = {}) =>
  clientParity(react, Render, { is: is as Component<Props>, ...props })

describe("Svelte matches React", () => {
  it("Heading", async () => {
    await same(r(R.Heading, null, "Settings"), Heading, { text: "Settings" })
    await same(r(R.Heading, { level: 5 }, "E"), Heading, { level: 5, text: "E" })
    await clientParity(
      r(
        R.Heading.Level,
        null,
        r(R.Heading, null, "A"),
        r(R.Heading.Level, null, r(R.Heading, null, "B")),
      ),
      Nested,
      {},
    )
    await clientParity(r(R.Heading, { render: r("h4") }, "H"), AsChild, {
      is: Heading as Component<Props>,
      tag: "h4",
      text: "H",
    } as never)
  })

  it("Label", async () => {
    await clientParity(
      r("div", null, r(R.Label, { htmlFor: "n" }, "Name"), r("input", { id: "n" })),
      Labels,
      {},
    )
    await clientParity(r(R.Label, null, "Name ", r("input")), Labels, { wrap: true })
  })

  it("Link", async () => {
    await same(r(R.Link, { href: "/a" }, "A"), Link, { href: "/a", text: "A" })
    await same(r(R.Link, { href: "mailto:a@b.c" }, "M"), Link, { href: "mailto:a@b.c", text: "M" })
    await same(r(R.Link, { href: "https://x.test/", target: "_blank" }, "X"), Link, {
      href: "https://x.test/",
      target: "_blank",
      text: "X",
    })
    await same(r(R.Link, { href: "/a", disabled: true }, "D"), Link, {
      href: "/a",
      disabled: true,
      text: "D",
    })
    await same(r(R.Link, { href: "/a", current: "page" }, "C"), Link, {
      href: "/a",
      current: "page",
      text: "C",
    })
  })

  it("Skeleton", async () => {
    const reactCard = ({ wrap = false, ...p }: Props) =>
      r(
        "section",
        { "aria-label": "Comments" },
        r(
          R.Skeleton.Root,
          p,
          r(R.Skeleton.Status),
          r(
            R.Skeleton.Content,
            { render: r("ul") },
            r("li", null, r(R.Skeleton.Item)),
            r(
              "li",
              null,
              wrap
                ? r(R.Skeleton.Item, null, r("button", { type: "button" }, "Reply"))
                : r(R.Skeleton.Item),
            ),
          ),
        ),
      )
    for (const p of [
      { loading: true },
      { loading: false },
      { loading: true, wrap: true },
      { animate: false },
    ]) {
      await clientParity(reactCard(p), Card, p)
    }
  })
})

describe("Svelte Link routing", () => {
  it("routes through RouterProvider; a disabled link drops the consumer's click", () => {
    const navigate = vi.fn()
    const onclick = vi.fn()
    mount(Router, { navigate, onclick })
    screen.getByRole("link", { name: "Docs" }).click()
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate.mock.calls[0]?.[0]).toBe("/docs")
    screen.getByText("Off").click()
    expect(onclick).not.toHaveBeenCalled()
  })
})

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const PENDING = Symbol.for("rind-ui.announcements.pending")
function announcementCount(): ConsumerInvariant<typeof skeletonContract> {
  let seen = installAnnouncementLog().length
  let last: string | undefined
  return {
    name: "skeleton-announces-on-load",
    check: async ({ env, state, props }) => {
      await env.until(
        async () => (Reflect.get(globalThis, PENDING) as number | undefined) ?? 0,
        (n) => n === 0,
      )
      const now = installAnnouncementLog().length
      const grew = now - seen
      const expected = last === "loading" && state === "loaded" && props["announceOnLoad"] ? 1 : 0
      seen = now
      last = state
      return grew === expected ? undefined : `announced ${grew} times, expected ${expected}`
    },
  }
}
function variant(name: string, start: Props) {
  describe(`svelte skeleton model: ${name}`, () => {
    testMachine(skeletonContract, {
      test: it,
      setup: () => mount(Card, { ...start }),
      rerender: (next, rendered) => rendered.rerender(next as unknown as Props),
      target: () => screen,
      anchor: [] as never,
      props: {
        loading: start["loading"],
        announceOnLoad: start["announceOnLoad"],
        messages: skeletonMessages,
        id: "oracle",
      } as never,
      invariants: [announcementCount()],
      a11y,
      modalities: ["pointer"],
    })
  })
}
variant("loading, silent", { loading: true })
variant("loaded first", { loading: false })
variant("announceOnLoad", { loading: true, announceOnLoad: "12 comments loaded" })
variant("wrapping items", { loading: true, wrap: true, announceOnLoad: true })
variant("animate off", { loading: true, animate: false })
