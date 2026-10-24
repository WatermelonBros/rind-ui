// The Skeleton contract model (React's variants) against the Angular parts, and markup parity.
import { Component, input } from "@angular/core"
import { skeletonContract, skeletonMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { type ConsumerInvariant, installAnnouncementLog, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Skeleton } from "./skeleton"

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
/** The inputs the next fixture starts with (a server render cannot set inputs). */
let current: Props = {}

@Component({
  selector: "rind-f",
  imports: [Skeleton],
  template: `<section aria-label="Comments">
    <div
      rindSkeletonRoot
      [loading]="loading()"
      [announceOnLoad]="announceOnLoad()"
      [animate]="animate()"
    >
      <span rindSkeletonStatus></span>
      <ul rindSkeletonContent>
        <li><span rindSkeletonItem></span></li>
        <li>
          @if (wrap()) {
            <span rindSkeletonItem><button type="button">Reply</button></span>
          } @else {
            <span rindSkeletonItem></span>
          }
        </li>
      </ul>
    </div>
  </section>`,
})
class Card {
  readonly loading = input(current.loading ?? true)
  readonly announceOnLoad = input(current.announceOnLoad)
  readonly animate = input(current.animate ?? true)
  readonly wrap = input(current.wrap ?? false)
}

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
  describe(`angular skeleton model: ${name}`, () => {
    testMachine(skeletonContract, {
      test: it,
      setup: () => {
        current = start
        return mount(Card)
      },
      rerender: (next, rendered) =>
        rendered.rerender({ loading: (next as { loading?: boolean }).loading ?? true }),
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

describe("Angular Skeleton matches React", () => {
  it("loading, loaded, wrapping, animate off", async () => {
    for (const p of [
      { loading: true },
      { loading: false },
      { loading: true, wrap: true },
      { animate: false },
    ]) {
      current = p
      await both(reactCard(p), Card)
    }
  })

  it("loaded: the Status keeps its element, hidden even under an author display rule", async () => {
    current = { loading: false }
    const style = document.head.appendChild(document.createElement("style"))
    style.textContent = `[data-scope="skeleton"] { display: block; }`
    try {
      const { host } = await mount(Card)
      const status = host.querySelector<HTMLElement>('[data-scope="skeleton"][hidden]')
      expect(status?.hidden).toBe(true)
      expect(status && getComputedStyle(status).display).toBe("none")
      expect(
        status?.getAttributeNames().filter((n) => n === "role" || n.startsWith("aria-")),
      ).toEqual([])
      expect(screen.queryByText(skeletonMessages.loading)).toBeNull()
    } finally {
      style.remove()
    }
  })
})
