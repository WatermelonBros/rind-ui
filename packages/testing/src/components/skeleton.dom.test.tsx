// Skeleton through its driver (add-skeleton 4.2, 3.2): the queries, the announcement log,
// Tab past stale controls, the multiple-match failure and the Status placement warning.
import { Skeleton, type SkeletonRootProps } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getSkeleton } from "../index"

afterEach(() => vi.restoreAllMocks())

function Comments(props: SkeletonRootProps) {
  return (
    <section aria-label="Comments">
      <button type="button">Before</button>
      <Skeleton.Root {...props}>
        <Skeleton.Status />
        <Skeleton.Content render={<ul />}>
          <li>
            <Skeleton.Item />
          </li>
          <li>
            <Skeleton.Item>
              <button type="button">Reply</button>
            </Skeleton.Item>
          </li>
        </Skeleton.Content>
      </Skeleton.Root>
      <button type="button">After</button>
    </section>
  )
}

const section = () => screen.getByRole("region", { name: "Comments" })

describe("Skeleton driver", () => {
  it("reads the loading state and text (spec: Driver queries)", async () => {
    const { rerender } = render(<Comments loading />)
    const s = getSkeleton(screen, { within: section() })
    expect(await s.isLoading()).toBe(true)
    expect(await s.statusText()).toBe("Loading")
    rerender(<Comments loading={false} />)
    expect(await s.isLoading()).toBe(false)
    expect(await s.statusText()).toBe("")
  })

  it("custom Status text", async () => {
    render(
      <Skeleton.Root>
        <Skeleton.Status>Loading comments</Skeleton.Status>
      </Skeleton.Root>,
    )
    expect(await getSkeleton(screen).statusText()).toBe("Loading comments")
  })

  it("announces once on loading → loaded with announceOnLoad", async () => {
    const { rerender } = render(<Comments loading announceOnLoad="12 comments loaded" />)
    const s = getSkeleton(screen, { within: section() })
    expect(await s.announcements()).toEqual([])
    rerender(<Comments loading={false} announceOnLoad="12 comments loaded" />)
    const spoken = await s.announcements()
    expect(spoken).toHaveLength(1)
    expect(spoken[0]).toMatchObject({ message: "12 comments loaded", priority: "polite" })
  })

  it("is silent by default and when mounted loaded (chakra-ui#2864)", async () => {
    const { rerender } = render(<Comments loading />)
    const s = getSkeleton(screen, { within: section() })
    expect(await s.announcements()).toEqual([])
    rerender(<Comments loading={false} />)
    expect(await s.announcements()).toEqual([])
    const t = render(<Comments loading={false} announceOnLoad />)
    t.unmount()
    expect(await s.announcements()).toEqual([])
  })

  it("a wrapped button is unreachable while loading, reachable after load", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Comments loading />)
    const reply = () => screen.getByText("Reply")
    expect(reply().closest("[inert]")).not.toBeNull()
    if (!navigator.userAgent.includes("jsdom")) {
      // jsdom does not implement inert; real engines refuse focus inside it.
      reply().focus()
      expect(document.activeElement).not.toBe(reply())
    }
    rerender(<Comments loading={false} />)
    expect(reply().closest("[inert], [aria-hidden]")).toBeNull()
    screen.getByRole("button", { name: "Before" }).focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reply" }))
  })

  it("fails listing every match when two Skeletons are in the container", async () => {
    render(
      <div data-testid="two">
        <Skeleton.Root />
        <Skeleton.Root />
      </div>,
    )
    await expect(getSkeleton(screen).isLoading()).rejects.toThrow(/2 elements match/)
  })

  it("warns when Status is inside Content", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await act(async () => {
      render(
        <Skeleton.Root>
          <Skeleton.Content>
            <Skeleton.Status />
          </Skeleton.Content>
        </Skeleton.Root>,
      )
    })
    expect(warn.mock.calls.some((c) => /outside Content/.test(String(c[0])))).toBe(true)
  })
})
