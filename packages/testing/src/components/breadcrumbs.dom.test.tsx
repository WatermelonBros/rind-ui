// add-breadcrumbs 3.2, 4.2, 5.1, 5.2: the trail through its driver, in jsdom and real
// browsers: landmark and list, current item rules, separators, collapse with a Popover in the
// Ellipsis, Tab order, routing, focus kept on a crumb that becomes current, non-link items,
// development warnings, the contract's invariants and axe.
import { Breadcrumbs, Link, Popover, RindProvider, RouterProvider } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import axe from "axe-core"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeRouter, getBreadcrumbs, interceptNativeNavigation, navigationLog } from "../index"

beforeEach(() => {
  interceptNativeNavigation(window)
  navigationLog().length = 0
})
afterEach(() => vi.restoreAllMocks())

const drv = (name = "Breadcrumbs") => getBreadcrumbs(document.body, { name })

interface Crumb {
  readonly value: string
  readonly label: string
  readonly href?: string
  readonly current?: boolean
}
const TRAIL: readonly Crumb[] = [
  { value: "home", label: "Home", href: "/" },
  { value: "docs", label: "Docs", href: "/docs" },
  { value: "link", label: "Link" },
]
const SIX: readonly Crumb[] = ["Home", "Docs", "Guides", "Forms", "Fields", "Page"].map(
  (label, i) => ({ value: label.toLowerCase(), label, ...(i < 5 ? { href: `/${i}` } : {}) }),
)

function Trail({
  crumbs = TRAIL,
  maxItems,
  data = false,
  children,
}: {
  crumbs?: readonly Crumb[]
  maxItems?: number
  data?: boolean
  children?: ReactNode
}) {
  return (
    <Breadcrumbs.Root
      {...(maxItems === undefined ? {} : { maxItems })}
      {...(data
        ? {
            items: crumbs.map((c) => ({
              key: c.value,
              textValue: c.label,
              ...(c.href ? { href: c.href } : {}),
              ...(c.current === undefined ? {} : { current: c.current }),
            })),
          }
        : {})}
    >
      {children}
      <Breadcrumbs.List>
        {crumbs.map((c, i) => (
          <Fragment2 key={c.value} index={i}>
            <Breadcrumbs.Item
              value={c.value}
              {...(c.current === undefined ? {} : { current: c.current })}
            >
              <Breadcrumbs.Link {...(c.href ? { href: c.href } : {})}>{c.label}</Breadcrumbs.Link>
              <Breadcrumbs.Separator>/</Breadcrumbs.Separator>
            </Breadcrumbs.Item>
          </Fragment2>
        ))}
      </Breadcrumbs.List>
    </Breadcrumbs.Root>
  )
}

/** The Ellipsis goes right after the first Item (the default itemsBeforeCollapse). */
function Fragment2({ index, children }: { index: number; children: ReactNode }) {
  return (
    <>
      {children}
      {index === 0 && (
        <Breadcrumbs.Ellipsis>
          {({ items, label }) => (
            <Popover.Root>
              <Popover.Trigger aria-label={label}>…</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Content aria-label="More breadcrumbs">
                    <ul>
                      {items.map((it) => (
                        <li key={it.key}>
                          <Link {...(it.href ? { href: it.href } : {})}>{it.textValue}</Link>
                        </li>
                      ))}
                    </ul>
                  </Popover.Content>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          )}
        </Breadcrumbs.Ellipsis>
      )}
    </>
  )
}

async function axeClean() {
  const r = await axe.run(document.body, { rules: { region: { enabled: false } } })
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([])
}

describe("landmark and list", () => {
  it('a navigation landmark named "Breadcrumbs" holds an ol of the crumbs', async () => {
    render(<Trail />)
    const nav = screen.getByRole("navigation", { name: "Breadcrumbs" })
    const list = nav.querySelector("ol")
    expect(list?.children).toHaveLength(3)
    expect(await drv().items()).toEqual(["Home", "Docs", "Link"])
    await axeClean()
  })

  it("the provider localises the name", () => {
    render(
      <RindProvider messages={{ breadcrumbs: { label: "Percorso" } }}>
        <Trail />
      </RindProvider>,
    )
    expect(screen.getByRole("navigation", { name: "Percorso" })).toBeTruthy()
  })

  it("extra controls sit in the landmark, not in the list", () => {
    render(
      <Trail>
        <button type="button">Back</button>
      </Trail>,
    )
    const nav = screen.getByRole("navigation", { name: "Breadcrumbs" })
    expect(nav.contains(screen.getByRole("button", { name: "Back" }))).toBe(true)
    expect(nav.querySelector("ol")?.children).toHaveLength(3)
  })

  it("a trail update keeps the DOM nodes (react-spectrum#1961)", () => {
    const { rerender } = render(<Trail crumbs={TRAIL.slice(0, 2)} />)
    const home = screen.getByRole("link", { name: "Home" })
    rerender(<Trail />)
    expect(screen.getByRole("link", { name: "Home" })).toBe(home)
  })
})

describe("current item", () => {
  it("the last item by default, a span with tabindex -1 and no link role", async () => {
    render(<Trail />)
    expect(await drv().current()).toEqual({ name: "Link", value: "page" })
    const current = screen.getByText("Link")
    expect(current.tagName).toBe("SPAN")
    expect(current.getAttribute("tabindex")).toBe("-1")
    expect(current.getAttribute("role")).toBeNull()
    expect(current.closest("li")?.hasAttribute("data-current")).toBe(true)
    expect(screen.queryByRole("link", { name: "Link" })).toBeNull()
  })

  it("current={false} on the last item: nothing current (react-spectrum#6561)", async () => {
    render(<Trail crumbs={[TRAIL[0] as Crumb, { value: "x", label: "X", current: false }]} />)
    expect(await drv().current()).toBeNull()
  })

  it("a current item with href stays a link with aria-current", async () => {
    render(<Trail crumbs={[TRAIL[0] as Crumb, { value: "d", label: "Docs", href: "/docs" }]} />)
    const link = screen.getByRole("link", { name: "Docs" })
    expect(link.getAttribute("aria-current")).toBe("page")
    expect(await drv().href("Docs")).toBe("/docs")
  })

  it("currentValue sets the aria-current value", () => {
    render(
      <Breadcrumbs.Root currentValue="location">
        <Breadcrumbs.List>
          <Breadcrumbs.Item value="a">
            <Breadcrumbs.Link>Here</Breadcrumbs.Link>
          </Breadcrumbs.Item>
        </Breadcrumbs.List>
      </Breadcrumbs.Root>,
    )
    expect(screen.getByText("Here").getAttribute("aria-current")).toBe("location")
  })

  it("focus stays on a crumb that becomes current (react-spectrum#2592, #5294)", async () => {
    const { rerender } = render(<Trail />)
    const docs = screen.getByRole("link", { name: "Docs" })
    act(() => docs.focus())
    // The app navigated to Docs: the trail now ends at Docs, without href.
    rerender(<Trail crumbs={[TRAIL[0] as Crumb, { value: "docs", label: "Docs" }]} />)
    const now = screen.getByText("Docs")
    expect(now.getAttribute("aria-current")).toBe("page")
    expect(document.activeElement).toBe(now)
  })
})

describe("separators", () => {
  it("aria-hidden, inside the Item, the last one marked data-last", async () => {
    render(<Trail />)
    const seps = document.querySelectorAll('[data-part="separator"]')
    expect(seps).toHaveLength(3)
    for (const s of seps) {
      expect(s.getAttribute("aria-hidden")).toBe("true")
      expect(s.parentElement?.tagName).toBe("LI")
    }
    expect(seps[2]?.hasAttribute("data-last")).toBe(true)
    expect(seps[0]?.hasAttribute("data-last")).toBe(false)
  })
})

describe("collapse", () => {
  it("six items, maxItems 4: items 2–5 hidden, the Ellipsis after item 1", async () => {
    render(<Trail crumbs={SIX} maxItems={4} />)
    const d = drv()
    expect(await d.collapsedCount()).toBe(4)
    expect(await d.items()).toEqual(["Home", "Show 4 more breadcrumbs", "Page"])
    const hidden = document.querySelectorAll('[data-part="item"][hidden]')
    expect(hidden).toHaveLength(4)
    const ellipsis = document.querySelector('[data-part="ellipsis"]')
    expect(ellipsis?.previousElementSibling?.textContent).toContain("Home")
    expect(screen.getByRole("button", { name: "Show 4 more breadcrumbs" })).toBeTruthy()
    await axeClean()
  })

  it("openCollapsed opens the ellipsis popup", async () => {
    render(<Trail crumbs={SIX} maxItems={4} />)
    await drv().openCollapsed()
    expect(screen.getByRole("link", { name: "Guides" })).toBeTruthy()
  })

  it("a short trail never collapses (react-spectrum#2923)", async () => {
    for (const n of [1, 2, 3]) {
      const { unmount } = render(<Trail crumbs={SIX.slice(0, n)} maxItems={2} />)
      expect(await drv().collapsedCount()).toBe(0)
      unmount()
    }
  })

  it("maxItems undefined shows every item again", async () => {
    const { rerender } = render(<Trail crumbs={SIX} maxItems={4} />)
    rerender(<Trail crumbs={SIX} />)
    expect(await drv().items()).toHaveLength(6)
  })

  it("the data-driven items form collapses in the first render", () => {
    render(<Trail crumbs={SIX} maxItems={4} data />)
    expect(document.querySelectorAll('[data-part="item"][hidden]')).toHaveLength(4)
  })

  it("followCollapsed opens the popup and follows the collapsed item once", async () => {
    render(<Trail crumbs={SIX} maxItems={4} />)
    await drv().followCollapsed("Guides")
    expect(navigationLog().filter((n) => n.href.endsWith("/2"))).toHaveLength(1)
  })
})

describe("keyboard and routing", () => {
  it("Tab visits the links and the ellipsis trigger, never the current text", async () => {
    const user = userEvent.setup()
    render(<Trail crumbs={SIX} maxItems={4} />)
    await user.tab()
    expect(document.activeElement?.textContent).toBe("Home")
    await user.tab()
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Show 4 more breadcrumbs")
    await user.tab()
    expect(document.activeElement).toBe(document.body)
  })

  it("client routing: follow navigates once through the router", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Trail />
      </RouterProvider>,
    )
    await drv().follow("Docs")
    expect(router.calls).toEqual([{ href: "/docs", routerOptions: undefined }])
  })

  it("follow by keyboard", async () => {
    render(<Trail />)
    await drv().via("keyboard").follow("Docs")
    expect(navigationLog().at(-1)?.href).toMatch(/\/docs$/)
  })
})

describe("items with their own controls", () => {
  it("a Menu trigger per segment takes aria-current from the Item state (Reado)", async () => {
    render(
      <Breadcrumbs.Root>
        <Breadcrumbs.List>
          {["src", "app.tsx"].map((name) => (
            <Breadcrumbs.Item key={name} value={name}>
              {(state) => (
                <button type="button" aria-current={state.current ? "location" : undefined}>
                  {name}
                </button>
              )}
            </Breadcrumbs.Item>
          ))}
        </Breadcrumbs.List>
      </Breadcrumbs.Root>,
    )
    expect(screen.getByRole("button", { name: "app.tsx" }).getAttribute("aria-current")).toBe(
      "location",
    )
    expect(await drv().current()).toEqual({ name: "app.tsx", value: null })
  })

  it("Item state does not leak into a Link inside the current Item (react-spectrum#10571)", () => {
    render(
      <Breadcrumbs.Root>
        <Breadcrumbs.List>
          <Breadcrumbs.Item value="here">
            <Breadcrumbs.Link>Here</Breadcrumbs.Link>
            <Link href="/other">Other</Link>
          </Breadcrumbs.Item>
        </Breadcrumbs.List>
      </Breadcrumbs.Root>,
    )
    const other = screen.getByRole("link", { name: "Other" })
    expect(other.getAttribute("aria-current")).toBeNull()
    expect(other.getAttribute("aria-disabled")).toBeNull()
  })
})

describe("development warnings", () => {
  it("a current Item without any aria-current element", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Breadcrumbs.Root>
        <Breadcrumbs.List>
          <Breadcrumbs.Item value="x">
            <button type="button">X</button>
          </Breadcrumbs.Item>
        </Breadcrumbs.List>
      </Breadcrumbs.Root>,
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("aria-current"))
  })

  it("inside a listbox popup (react-spectrum#7790)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <div role="listbox" aria-label="Results">
        <Trail />
      </div>,
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("listbox, menu or combobox"))
  })
})

describe("contract invariants", () => {
  const run = async () => {
    const d = drv()
    const out: string[] = []
    for (const inv of d.contract.invariants ?? []) {
      const msg = await inv.check({
        env: d.env as never, // the driver's env, typed for its own parts
        state: "static",
        modality: "pointer",
        props: {},
        values: {},
      })
      if (msg) out.push(`${inv.name}: ${msg}`)
    }
    return out
  }

  it("hold on a well-formed trail", async () => {
    render(<Trail crumbs={SIX} maxItems={4} />)
    expect(await run()).toEqual([])
  })

  it("a wrapper that renders separators as list items fails, naming the element", async () => {
    render(
      <Breadcrumbs.Root>
        <Breadcrumbs.List>
          <Breadcrumbs.Item value="a">
            <Breadcrumbs.Link href="/a">A</Breadcrumbs.Link>
          </Breadcrumbs.Item>
          <Breadcrumbs.Item value="sep" render={<li />}>
            <Breadcrumbs.Separator render={<li />}>/</Breadcrumbs.Separator>
          </Breadcrumbs.Item>
        </Breadcrumbs.List>
      </Breadcrumbs.Root>,
    )
    const out = await run()
    expect(out.join("\n")).toMatch(/separator is a list item <li>/)
  })
})
