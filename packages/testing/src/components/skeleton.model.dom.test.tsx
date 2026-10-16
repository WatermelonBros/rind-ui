// Model-based tests (add-skeleton 5.1): loading ⇄ loaded through prop steps, with and without
// announceOnLoad, wrapping Items and animate off; the per-contract invariants run after every
// step, plus the announcement count. A wrapper that puts Status inside Content fails.
import { skeletonContract, skeletonMessages } from "@rind-ui/core"
import { Skeleton, type SkeletonRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import {
  type ConsumerInvariant,
  domEnv,
  installAnnouncementLog,
  spokenLog,
  testMachine,
} from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Props = SkeletonRootProps & { readonly wrap?: boolean; readonly statusInside?: boolean }

function Card({ wrap = false, statusInside = false, ...props }: Props) {
  const status = <Skeleton.Status />
  return (
    <section aria-label="Comments">
      <Skeleton.Root {...props}>
        {statusInside ? null : status}
        <Skeleton.Content render={<ul />}>
          {statusInside ? <li>{status}</li> : null}
          <li>
            <Skeleton.Item />
          </li>
          <li>
            {wrap ? (
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
}

/** The log grows by one exactly on loading → loaded when announceOnLoad is set. */
function announcementCount(): ConsumerInvariant<typeof skeletonContract> {
  let seen = installAnnouncementLog().length
  let last: string | undefined
  return {
    name: "skeleton-announces-on-load",
    check: async ({ env, state, props }) => {
      // Waits until no keyed announcement is pending (a condition, not a delay).
      await env.announcements()
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
  describe(`skeleton model: ${name}`, () => {
    testMachine(skeletonContract, {
      test: it,
      setup: () => render(<Card {...start} />),
      rerender: (next, rendered) =>
        rendered.rerender(<Card {...start} {...(next as unknown as Props)} />),
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

describe("screen reader reading", () => {
  it("reads Loading once and no placeholder (mui/material-ui#28057, #31363, RS#8479)", async () => {
    const { container } = render(<Card loading wrap />)
    const log = await spokenLog(container, async (v) => {
      for (let i = 0; i < 12; i += 1) await v.next()
    })
    // One pass through the region (the reader wraps around after its end).
    const pass = log.slice(0, log.indexOf("end of region, Comments") + 1)
    expect(pass.filter((p) => p.includes("Loading"))).toHaveLength(1)
    expect(pass.some((p) => /Reply|group|progressbar/.test(p))).toBe(false)
  })
})

describe("broken Skeleton fails with the invariant's name", () => {
  it("Status inside Content → skeleton-status-outside-content", { timeout: 60_000 }, async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    testMachine(skeletonContract, {
      test: (n, fn) => tests.push({ name: n, fn }),
      setup: () => render(<Card loading statusInside />),
      rerender: (next, rendered) =>
        rendered.rerender(<Card statusInside {...(next as unknown as Props)} />),
      target: () => domEnv({ timeout: 200 }),
      anchor: [] as never,
      props: { loading: true, messages: skeletonMessages, id: "oracle" } as never,
      modalities: ["pointer"],
    })
    const errors: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => errors.push(e.message))
      document.body.innerHTML = ""
    }
    expect(errors.some((e) => e.includes("skeleton-status-outside-content"))).toBe(true)
    expect(errors.some((e) => e.includes("Status part"))).toBe(true)
  })
})
