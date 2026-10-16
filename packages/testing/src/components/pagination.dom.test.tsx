// Pagination through its driver (add-pagination 4.2, 5.2, 5.4), in jsdom and in real browsers.
import { domEnvironment } from "@rind-ui/core"
import {
  Pagination,
  type PaginationRootProps,
  type PaginationRootState,
  RouterProvider,
} from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { type ReactNode, StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { getPagination, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform

/** The usual composition: First, Previous, the range, Next, Last. */
function Pager(props: PaginationRootProps) {
  return (
    <Pagination.Root {...props}>
      {(state) => (
        <Pagination.List>
          <Pagination.Item type="trigger">
            <Pagination.First />
          </Pagination.Item>
          <Pagination.Item type="trigger">
            <Pagination.Previous />
          </Pagination.Item>
          {state.pages.map((e) =>
            e.type === "page" ? (
              <Pagination.Item key={e.key}>
                <Pagination.Page value={e.value} />
              </Pagination.Item>
            ) : (
              <Pagination.Item key={e.key} type="ellipsis">
                <Pagination.Ellipsis position={e.position} />
              </Pagination.Item>
            ),
          )}
          <Pagination.Item type="trigger">
            <Pagination.Next />
          </Pagination.Item>
          <Pagination.Item type="trigger">
            <Pagination.Last />
          </Pagination.Item>
        </Pagination.List>
      )}
    </Pagination.Root>
  )
}

const driver = () => getPagination(screen, { name: "Pagination" }, { platform })
const control = (name: string) => screen.getByRole("button", { name })
const unavailable = (el: Element) => el.getAttribute("aria-disabled") === "true"

describe("Pagination", () => {
  it("structure: a named nav with one list (spec Anatomy, Landmark And Naming)", () => {
    render(<Pager totalPages={10} />)
    const nav = screen.getByRole("navigation", { name: "Pagination" })
    expect(nav.tagName).toBe("NAV")
    expect(nav.querySelectorAll("ul")).toHaveLength(1)
    expect(nav.querySelector("ul")?.parentElement).toBe(nav)
  })

  it("driver: next, currentPage, visiblePages, goTo in pointer and keyboard", async () => {
    const onPageChange = vi.fn()
    render(<Pager totalPages={20} onPageChange={onPageChange} />)
    const p = driver()
    await p.next()
    expect(await p.currentPage()).toBe(2)
    await p.via("keyboard").goTo(5)
    expect(await p.currentPage()).toBe(5)
    expect(await p.visiblePages()).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 20])
    await p.last()
    await p.via("keyboard").first()
    expect(await p.currentPage()).toBe(1)
    expect(onPageChange.mock.calls.map((c) => [c[0], c[1].reason])).toEqual([
      [2, "NEXT"],
      [5, "SET_PAGE"],
      [20, "LAST"],
      [1, "FIRST"],
    ])
  })

  it("current page: aria-current and data-current agree, stays enabled (react-spectrum#6159)", () => {
    render(<Pager totalPages={3} defaultPage={3} />)
    const page = control("Page 3")
    expect(page.getAttribute("aria-current")).toBe("page")
    expect(page.hasAttribute("data-current")).toBe(true)
    expect(unavailable(page)).toBe(false)
    expect(page.hasAttribute("disabled")).toBe(false)
    expect(control("Page 2").hasAttribute("aria-current")).toBe(false)
    const next = control("Next page")
    expect(unavailable(next)).toBe(true)
    expect(next.hasAttribute("data-disabled")).toBe(true)
    expect(screen.getByRole("navigation").querySelectorAll("[aria-current]")).toHaveLength(1)
  })

  it("activating the current page does nothing", async () => {
    const onPageChange = vi.fn()
    render(<Pager totalPages={5} onPageChange={onPageChange} />)
    await act(async () => control("Page 1").click())
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it("empty data: one page, every trigger unavailable (zag#2921, bits-ui#894)", () => {
    render(<Pager count={0} />)
    expect(screen.getAllByRole("button", { name: /^Page / })).toHaveLength(1)
    for (const name of ["First page", "Previous page", "Next page", "Last page"]) {
      expect(unavailable(control(name))).toBe(true)
    }
  })

  it("boundaries on 5 of 5 (bits-ui#911)", () => {
    render(<Pager totalPages={5} defaultPage={5} />)
    expect(unavailable(control("Next page"))).toBe(true)
    expect(unavailable(control("Last page"))).toBe(true)
    expect(unavailable(control("Previous page"))).toBe(false)
    expect(unavailable(control("First page"))).toBe(false)
  })

  it("last row deleted: page clamped with reason COUNT.CHANGE (kobaltedev/kobalte#461)", () => {
    const onPageChange = vi.fn()
    const { rerender } = render(<Pager count={30} defaultPage={3} onPageChange={onPageChange} />)
    rerender(<Pager count={20} defaultPage={3} onPageChange={onPageChange} />)
    expect(control("Page 2").getAttribute("aria-current")).toBe("page")
    expect(onPageChange.mock.calls.map((c) => [c[0], c[1].reason])).toEqual([[2, "COUNT.CHANGE"]])
  })

  it("controlled refusal: the parent keeps the page", async () => {
    render(<Pager totalPages={5} page={2} onPageChange={() => {}} />)
    await driver()
      .next()
      .catch(() => {})
    expect(control("Page 2").getAttribute("aria-current")).toBe("page")
  })

  it("holding Enter on Next to the last page keeps focus on Next (spec Disabled)", async () => {
    render(<Pager totalPages={3} />)
    const next = control("Next page")
    await act(async () => next.focus())
    for (let i = 0; i < 4; i++) {
      fireEvent.keyDown(next, { key: "Enter" })
      fireEvent.keyUp(next, { key: "Enter" })
    }
    expect(control("Page 3").getAttribute("aria-current")).toBe("page")
    expect(document.activeElement).toBe(next)
    expect(unavailable(next)).toBe(true)
  })

  it("disabled while loading: no change, every control data-disabled, focus kept (zag#626)", async () => {
    const onPageChange = vi.fn()
    const { rerender } = render(<Pager totalPages={5} onPageChange={onPageChange} />)
    const two = control("Page 2")
    await act(async () => two.focus())
    rerender(<Pager totalPages={5} onPageChange={onPageChange} disabled />)
    expect(document.activeElement).toBe(two)
    await act(async () => control("Page 3").click())
    expect(onPageChange).not.toHaveBeenCalled()
    for (const el of screen.getAllByRole("button"))
      expect(el.hasAttribute("data-disabled")).toBe(true)
    expect(screen.getByRole("navigation").hasAttribute("data-disabled")).toBe(true)
  })

  it("focusableWhenDisabled={false}: native disabled on unavailable buttons", () => {
    render(<Pager totalPages={3} focusableWhenDisabled={false} />)
    expect(control("Previous page").hasAttribute("disabled")).toBe(true)
  })

  it("focus stays on the activated page near the end (spec Focus)", async () => {
    render(<Pager totalPages={20} />)
    const five = control("Page 5")
    await act(async () => five.focus())
    fireEvent.keyDown(five, { key: "Enter" })
    fireEvent.keyUp(five, { key: "Enter" })
    expect(control("Page 5").getAttribute("aria-current")).toBe("page")
    expect(document.activeElement).toBe(control("Page 5"))
  })

  it("arrow keys are the page's", async () => {
    render(<Pager totalPages={5} />)
    const two = control("Page 2")
    await act(async () => two.focus())
    fireEvent.keyDown(two, { key: "ArrowRight" })
    expect(document.activeElement).toBe(two)
    expect(control("Page 1").getAttribute("aria-current")).toBe("page")
  })

  it("virtual activation: a bare click with detail 0 advances once", async () => {
    render(<Pager totalPages={5} />)
    await act(async () => fireEvent.click(control("Next page"), { detail: 0 }))
    expect(control("Page 2").getAttribute("aria-current")).toBe("page")
  })

  it("page size keeps the reader's place; range is one-based (bits-ui#1346)", async () => {
    let state: PaginationRootState | undefined
    const capture = (p: Record<string, unknown>, st: PaginationRootState) => {
      state = st
      return <nav {...p} />
    }
    render(<Pagination.Root count={95} defaultPage={3} render={capture} />)
    expect(state?.range).toEqual({ start: 21, end: 30 })
    await act(async () => state?.setPageSize(25))
    expect(state?.page).toBe(1)
    expect(state?.range).toEqual({ start: 1, end: 25 })
    await act(async () => state?.setPage(4))
    expect(state?.range).toEqual({ start: 76, end: 95 })
  })

  it("a controlled page size from the parent keeps the reader's place too", () => {
    const onPageChange = vi.fn()
    const { rerender } = render(
      <Pager
        count={95}
        pageSize={10}
        onPageSizeChange={() => {}}
        defaultPage={3}
        onPageChange={onPageChange}
      />,
    )
    rerender(
      <Pager
        count={95}
        pageSize={25}
        onPageSizeChange={() => {}}
        defaultPage={3}
        onPageChange={onPageChange}
      />,
    )
    expect(control("Page 1").getAttribute("aria-current")).toBe("page")
    expect(onPageChange.mock.calls.map((c) => [c[0], c[1].reason])).toEqual([[1, "SET_PAGE_SIZE"]])
  })

  it("no live region and no announcement (spec Announcements)", async () => {
    const log = installAnnouncementLog()
    const start = log.length
    render(<Pager totalPages={5} />)
    await driver().next()
    expect(
      screen.getByRole("navigation").querySelector("[aria-live],[role=status],[role=alert]"),
    ).toBeNull()
    expect(log.length).toBe(start)
  })
})

describe("names and messages", () => {
  it("typed names (bits-ui#853); icon-only trigger in Italian", () => {
    render(<Pager totalPages={10} defaultPage={7} messages={{ next: "Pagina successiva" }} />)
    expect(control("Page 7")).toBeTruthy()
    expect(control("Pagina successiva")).toBeTruthy()
  })

  it("trigger with its own text keeps it", () => {
    render(
      <Pagination.Root totalPages={3} defaultPage={2}>
        <Pagination.List>
          <Pagination.Item type="trigger">
            <Pagination.Previous>Older posts</Pagination.Previous>
          </Pagination.Item>
        </Pagination.List>
      </Pagination.Root>,
    )
    expect(control("Older posts")).toBeTruthy()
  })

  it("consumer aria-label on Root; duplicate landmark names warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <>
        <Pager totalPages={3} />
        <Pager totalPages={3} />
        <Pager totalPages={3} aria-label="Results, bottom" />
      </>,
    )
    expect(screen.getByRole("navigation", { name: "Results, bottom" })).toBeTruthy()
    expect(
      warn.mock.calls.some(([m]) =>
        /two pagination landmarks are named "Pagination"/.test(String(m)),
      ),
    ).toBe(true)
    warn.mockRestore()
  })

  it("controlled page size without handler warns (ark#3724)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Pager count={50} pageSize={10} />)
    expect(
      warn.mock.calls.some(([m]) =>
        /pageSize is controlled without onPageSizeChange/.test(String(m)),
      ),
    ).toBe(true)
    warn.mockRestore()
  })
})

describe("link mode", () => {
  const href = (p: number) => `/posts?page=${p}`

  it("renders links, no buttons (ark#4056, ark#3475); boundary links have no href (zag#3399)", () => {
    render(<Pager totalPages={5} getPageHref={href} />)
    const nav = screen.getByRole("navigation")
    expect(nav.querySelectorAll("button")).toHaveLength(0)
    expect(screen.getByRole("link", { name: "Page 3" }).getAttribute("href")).toBe("/posts?page=3")
    expect(screen.getByRole("link", { name: "Next page" }).getAttribute("href")).toBe(
      "/posts?page=2",
    )
    const prev = screen.getByRole("link", { name: "Previous page" })
    expect(prev.hasAttribute("href")).toBe(false)
    expect(prev.getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByRole("link", { name: "Page 1" }).getAttribute("aria-current")).toBe("page")
  })

  it("client router: navigate once and onPageChange(3)", async () => {
    const navigate = vi.fn()
    const onPageChange = vi.fn()
    render(
      <RouterProvider navigate={navigate}>
        <Pager totalPages={5} getPageHref={href} onPageChange={onPageChange} />
      </RouterProvider>,
    )
    await act(async () => screen.getByRole("link", { name: "Page 3" }).click())
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate.mock.calls[0]?.[0]).toBe("/posts?page=3")
    expect(onPageChange.mock.calls[0]?.[0]).toBe(3)
  })

  it("a modifier click opens elsewhere: the page stays", async () => {
    const navigate = vi.fn()
    const onPageChange = vi.fn()
    render(
      <RouterProvider navigate={navigate}>
        <Pager totalPages={5} getPageHref={href} onPageChange={onPageChange} />
      </RouterProvider>,
    )
    const three = screen.getByRole("link", { name: "Page 3" })
    const mod = platform.mac ? { metaKey: true } : { ctrlKey: true }
    // The browser would open a tab; jsdom and the test page must not navigate.
    three.addEventListener("click", (e) => e.preventDefault())
    await act(async () => fireEvent.click(three, mod))
    expect(onPageChange).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe("server rendering", () => {
  async function hydrate(tree: ReactNode) {
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const before = container.innerHTML
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    const after = container.innerHTML
    const calls = error.mock.calls
    await act(async () => root?.unmount())
    container.remove()
    error.mockRestore()
    return { before, after, calls }
  }

  it.each([
    ["buttons", {}],
    ["links", { getPageHref: (p: number) => `/posts?page=${p}` }],
  ])("%s: ids, aria-current and hrefs hydrate unchanged in Strict Mode", async (_, extra) => {
    const tree = (
      <StrictMode>
        <Pager totalPages={20} defaultPage={10} aria-label="Posts" {...extra} />
      </StrictMode>
    )
    const { before, after, calls } = await hydrate(tree)
    expect(calls).toEqual([])
    expect(after).toBe(before)
    expect(before).toContain('aria-current="page"')
    expect(before).toContain('aria-label="Posts"')
  })

  it("render with a router link component", () => {
    function RouterLink(props: Record<string, unknown>) {
      return <a data-router="" {...props} />
    }
    render(
      <Pagination.Root totalPages={3} getPageHref={(p) => `/p/${p}`}>
        <Pagination.List>
          <Pagination.Item>
            <Pagination.Page value={2} render={<RouterLink />} />
          </Pagination.Item>
        </Pagination.List>
      </Pagination.Root>,
    )
    const link = screen.getByRole("link", { name: "Page 2" })
    expect(link.hasAttribute("data-router")).toBe(true)
    expect(link.getAttribute("href")).toBe("/p/2")
  })
})
