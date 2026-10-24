/** @jsxImportSource solid-js */
// The Skeleton contract model (React's variants) against the Solid parts, and markup parity.
import { skeletonContract, skeletonMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { type ConsumerInvariant, installAnnouncementLog, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Skeleton } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Props = {
  loading?: boolean
  announceOnLoad?: boolean | string
  animate?: boolean
  wrap?: boolean
}

// JSX reads the props (a store), so a rerender reaches the Skeleton.
const card = (p: Props): JSX.Element => (
  <section aria-label="Comments">
    <Skeleton.Root loading={p.loading} announceOnLoad={p.announceOnLoad} animate={p.animate}>
      <Skeleton.Status />
      <Skeleton.Content render={(props) => <ul {...props} />}>
        <li>
          <Skeleton.Item />
        </li>
        <li>
          {p.wrap ? (
            <Skeleton.Item>
              <button type="button">Reply</button>
            </Skeleton.Item>
          ) : (
            <Skeleton.Item />
          )}
        </li>
      </Skeleton.Content>
    </Skeleton.Root>
  </section>
)

const reactCard = ({ wrap = false, ...props }: Props) =>
  r(
    "section",
    { "aria-label": "Comments" },
    r(
      R.Skeleton.Root,
      props,
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
  describe(`solid skeleton model: ${name}`, () => {
    testMachine(skeletonContract, {
      test: it,
      setup: () => mount(card, { ...start }),
      rerender: (next, rendered) => rendered.rerender(next as unknown as Props),
      target: () => screen,
      anchor: [] as never,
      props: {
        loading: start.loading,
        announceOnLoad: start.announceOnLoad,
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

describe("Solid Skeleton matches React", () => {
  it("loading, loaded, wrapping, animate off", async () => {
    for (const p of [
      { loading: true },
      { loading: false },
      { loading: true, wrap: true },
      { animate: false },
    ]) {
      await clientParity(reactCard(p), () => card(p))
    }
  })
})
