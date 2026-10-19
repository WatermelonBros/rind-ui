// Navigation Menu scenarios (openspec add-navigation-menu), in jsdom and in real browsers,
// through the navigation menu driver where possible. Delays run on vi fake timers advanced
// through the adapter and user-event, so no real time passes.
import { NavigationMenu, type NavigationMenuRootProps, RindProvider } from "@rind-ui/react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { domEnv, getNavigationMenu } from "../index"

const advance = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))

function fakeTime() {
  vi.useFakeTimers()
  vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
  return { user, env: () => domEnv({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) }) }
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const centre = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
}

function Menu(
  props: Partial<NavigationMenuRootProps> & {
    viewport?: boolean
    nested?: boolean
    currentLabs?: boolean
    itemPositioners?: boolean
    wide?: boolean
  },
) {
  const {
    viewport = false,
    nested = false,
    currentLabs = false,
    itemPositioners = false,
    wide = false,
    ...root
  } = props
  const place = (content: ReactNode) =>
    itemPositioners ? <NavigationMenu.Positioner>{content}</NavigationMenu.Positioner> : content
  return (
    <>
      <a href="/before">Before</a>
      <NavigationMenu.Root {...root} style={wide ? { position: "relative" } : undefined}>
        <NavigationMenu.List
          style={wide ? { display: "flex", gap: 16, margin: 0, padding: 0 } : undefined}
        >
          <NavigationMenu.Item value="products">
            <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
            {place(
              <NavigationMenu.Content>
                <NavigationMenu.Link href="/analytics">Analytics</NavigationMenu.Link>
                <NavigationMenu.Link href="/engage" current={!currentLabs}>
                  Engage
                </NavigationMenu.Link>
                <input aria-label="Search products" />
                {nested && (
                  <NavigationMenu.Sub>
                    <NavigationMenu.List>
                      <NavigationMenu.Item value="more">
                        <NavigationMenu.Trigger>More</NavigationMenu.Trigger>
                        <NavigationMenu.Content>
                          <NavigationMenu.Link
                            href="/labs"
                            {...(currentLabs ? { current: "page" } : {})}
                          >
                            Labs
                          </NavigationMenu.Link>
                        </NavigationMenu.Content>
                      </NavigationMenu.Item>
                    </NavigationMenu.List>
                  </NavigationMenu.Sub>
                )}
              </NavigationMenu.Content>,
            )}
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Link href="/pricing">Pricing</NavigationMenu.Link>
          </NavigationMenu.Item>
          <NavigationMenu.Item value="resources">
            <NavigationMenu.Trigger>Resources</NavigationMenu.Trigger>
            {place(
              <NavigationMenu.Content
                style={
                  wide
                    ? { position: "absolute", left: 0, top: "100%", width: 400, height: 120 }
                    : undefined
                }
              >
                <NavigationMenu.Link href="/blog">Blog</NavigationMenu.Link>
              </NavigationMenu.Content>,
            )}
          </NavigationMenu.Item>
        </NavigationMenu.List>
        {viewport && <NavigationMenu.Viewport />}
      </NavigationMenu.Root>
      <a href="/after">After</a>
    </>
  )
}

const trigger = (name: string) => screen.getByRole("button", { name })
const active = () => document.activeElement

describe("NavigationMenu: semantics", () => {
  it("is a navigation landmark named Main with a list, buttons and links, no menu roles", () => {
    render(<Menu />)
    const nav = screen.getByRole("navigation", { name: "Main" })
    expect(nav.tagName).toBe("NAV")
    expect(screen.getByRole("list")).toBeTruthy()
    expect(screen.queryByRole("menu")).toBeNull()
    expect(screen.queryByRole("menuitem")).toBeNull()
    for (const el of nav.querySelectorAll("*")) {
      expect(el.hasAttribute("aria-orientation")).toBe(false)
      expect(el.hasAttribute("aria-haspopup")).toBe(false)
      expect(el.hasAttribute("aria-owns")).toBe(false)
    }
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("false")
  })

  it("closed content is in the document with hidden, never aria-hidden (SSR too)", () => {
    const html = renderToString(<Menu />)
    expect(html).toContain('href="/analytics"')
    expect(html).toMatch(/data-part="content"[^>]*hidden/)
    render(<Menu />)
    const content = document.getElementById(trigger("Products").getAttribute("aria-controls") ?? "")
    expect(content?.hidden).toBe(true)
    expect(content?.getAttribute("data-state")).toBe("closed")
    expect(content?.hasAttribute("aria-hidden")).toBe(false)
  })

  it("unmount mode removes closed content", () => {
    render(<Menu closedContent="unmount" />)
    expect(screen.queryByRole("link", { name: "Analytics", hidden: true })).toBeNull()
  })

  it("localised landmark name through the provider", () => {
    render(
      <RindProvider messages={{ "navigation-menu": { label: "Principale" } }}>
        <Menu />
      </RindProvider>,
    )
    expect(screen.getByRole("navigation", { name: "Principale" })).toBeTruthy()
  })

  it("current section: aria-current on the link, data-current on the trigger only", () => {
    render(<Menu />)
    const t = trigger("Products")
    expect(t.hasAttribute("data-current")).toBe(true)
    expect(t.hasAttribute("aria-current")).toBe(false)
  })
})

describe("NavigationMenu: press and keyboard", () => {
  it("Enter toggles and keeps focus on the trigger; Space too", async () => {
    const { user } = fakeTime()
    render(<Menu />)
    trigger("Products").focus()
    await user.keyboard("{Enter}")
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("true")
    expect(active()).toBe(trigger("Products"))
    await user.keyboard(" ")
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("false")
  })

  it("driver: open, openItem, links, followLink closes", async () => {
    const { env } = fakeTime()
    render(<Menu />)
    const menu = getNavigationMenu(env())
    await menu.open("Products")
    expect(await menu.openItem()).toBe("Products")
    expect(await menu.links("Products")).toEqual(["Analytics", "Engage"])
    expect(await menu.currentLink()).toBe("Engage")
    await menu.followLink("Analytics")
    expect(await menu.openItem()).toBe(null)
  })

  it("a press on another trigger switches in one change", async () => {
    const { user } = fakeTime()
    const onValueChange = vi.fn()
    render(<Menu onValueChange={onValueChange} />)
    await user.click(trigger("Products"))
    await user.click(trigger("Resources"))
    expect(onValueChange.mock.calls.map((c) => c[0])).toEqual(["products", "resources"])
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("false")
  })

  it("arrow keys move between top-level triggers and links, no wrap; ArrowDown enters", async () => {
    const { user } = fakeTime()
    render(<Menu />)
    trigger("Products").focus()
    await user.keyboard("{ArrowRight}")
    expect(active()).toBe(screen.getByRole("link", { name: "Pricing" }))
    await user.keyboard("{ArrowRight}")
    expect(active()).toBe(trigger("Resources"))
    await user.keyboard("{ArrowRight}")
    expect(active()).toBe(trigger("Resources"))
    await user.keyboard("{Home}")
    expect(active()).toBe(trigger("Products"))
    await user.keyboard("{Enter}{ArrowDown}")
    expect(active()).toBe(screen.getByRole("link", { name: "Analytics" }))
    await user.keyboard("{ArrowDown}")
    expect(active()).toBe(screen.getByRole("link", { name: "Engage" }))
  })

  it("keys in an input inside a panel are left alone", async () => {
    const { user } = fakeTime()
    render(<Menu />)
    await user.click(trigger("Products"))
    const input = screen.getByRole("textbox", { name: "Search products" })
    await user.click(input)
    await user.keyboard("a b{ArrowLeft}{ArrowDown}")
    expect((input as HTMLInputElement).value).toBe("a b")
    expect(active()).toBe(input)
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("true")
  })

  it("right-to-left: ArrowLeft goes to the next item", async () => {
    const { user } = fakeTime()
    render(
      <RindProvider dir="rtl">
        <div dir="rtl">
          <Menu />
        </div>
      </RindProvider>,
    )
    trigger("Products").focus()
    await user.keyboard("{ArrowRight}")
    expect(active()).toBe(trigger("Products"))
    await user.keyboard("{ArrowLeft}")
    expect(active()).toBe(screen.getByRole("link", { name: "Pricing" }))
  })

  it("Escape inside a panel closes it and focuses its trigger", async () => {
    const { user } = fakeTime()
    render(<Menu />)
    trigger("Products").focus()
    await user.keyboard("{Enter}{ArrowDown}")
    expect(active()).toBe(screen.getByRole("link", { name: "Analytics" }))
    await user.keyboard("{Escape}")
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("false")
    expect(active()).toBe(trigger("Products"))
  })

  it("Tab from an open trigger enters its panel, then continues after the trigger", async () => {
    const { user } = fakeTime()
    render(<Menu viewport />)
    trigger("Products").focus()
    await user.keyboard("{Enter}")
    await user.tab()
    expect(active()).toBe(screen.getByRole("link", { name: "Analytics" }))
    await user.tab()
    await user.tab()
    await user.tab()
    expect(active()).toBe(screen.getByRole("link", { name: "Pricing" }))
  })
})

describe("NavigationMenu: hover (fake time)", () => {
  it("opens after the open delay, closes after the close delay once the pointer left", async () => {
    const { env } = fakeTime()
    const onValueChange = vi.fn()
    render(<Menu onValueChange={onValueChange} />)
    const menu = getNavigationMenu(env()).via("pointer")
    await menu.hoverTrigger("Products")
    await advance(199)
    expect(await menu.openItem()).toBe(null)
    await advance(1)
    expect(await menu.openItem()).toBe("Products")
    expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ reason: "trigger-hover" })
    await menu.pointerAway()
    await advance(299)
    expect(await menu.openItem()).toBe("Products")
    await advance(1)
    expect(await menu.openItem()).toBe(null)
    expect(onValueChange.mock.calls.at(-1)?.[1]).toMatchObject({ reason: "pointer-leave" })
  })

  it("a hover or leave close never moves focus", async () => {
    const { env } = fakeTime()
    render(<Menu />)
    const before = screen.getByRole("link", { name: "Before" })
    before.focus()
    const menu = getNavigationMenu(env()).via("pointer")
    await menu.hover("Products")
    await menu.pointerAway()
    await advance(300)
    expect(await menu.openItem()).toBe(null)
    expect(active()).toBe(before)
  })

  it("an outside press does not move focus to the trigger", async () => {
    const { user } = fakeTime()
    render(<Menu />)
    trigger("Products").focus()
    await user.keyboard("{Enter}{ArrowDown}")
    expect(active()).toBe(screen.getByRole("link", { name: "Analytics" }))
    await user.click(document.body)
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("false")
    expect(active()).not.toBe(trigger("Products"))
  })

  it("patient click: a press soon after a hover open keeps it open, and leaving no longer closes", async () => {
    const { env, user } = fakeTime()
    render(<Menu />)
    const menu = getNavigationMenu(env()).via("pointer")
    await menu.hover("Products")
    await advance(100)
    await user.click(trigger("Products"))
    expect(await menu.openItem()).toBe("Products")
    await menu.pointerAway()
    await advance(1000)
    expect(await menu.openItem()).toBe("Products")
  })

  it("Escape, then moving within the trigger, does not reopen until the pointer leaves", async () => {
    const { env, user } = fakeTime()
    render(<Menu />)
    const menu = getNavigationMenu(env()).via("pointer")
    await menu.hover("Products")
    await user.keyboard("{Escape}")
    expect(await menu.openItem()).toBe(null)
    await menu.hoverTrigger("Products")
    await advance(1000)
    expect(await menu.openItem()).toBe(null)
    await menu.pointerAway()
    await advance(1000)
    await menu.hoverTrigger("Products")
    await advance(200)
    expect(await menu.openItem()).toBe("Products")
  })

  it("warm window: right after a close, the next trigger opens with no delay", async () => {
    const { env } = fakeTime()
    render(<Menu />)
    const menu = getNavigationMenu(env()).via("pointer")
    await menu.hover("Products")
    await menu.pointerAway()
    await advance(300)
    expect(await menu.openItem()).toBe(null)
    await menu.hoverTrigger("Resources")
    expect(await menu.openItem()).toBe("Resources")
  })

  it("switching while open is immediate", async () => {
    const { env } = fakeTime()
    render(<Menu />)
    const menu = getNavigationMenu(env()).via("pointer")
    await menu.hover("Products")
    await menu.hoverTrigger("Resources")
    expect(await menu.openItem()).toBe("Resources")
  })

  it("openOnHover={false}: hovering opens nothing", async () => {
    const { env } = fakeTime()
    render(<Menu openOnHover={false} />)
    const menu = getNavigationMenu(env())
    await menu.via("pointer").hoverTrigger("Products")
    await advance(1000)
    expect(await menu.openItem()).toBe(null)
  })

  it("a nested level inherits the root's delays", async () => {
    const { env } = fakeTime()
    render(<Menu nested openDelay={500} />)
    const menu = getNavigationMenu(env()).via("pointer")
    await menu.hover("Products")
    await menu.hoverTrigger("More")
    await advance(300)
    expect(trigger("More").getAttribute("aria-expanded")).toBe("false")
    await advance(200)
    expect(trigger("More").getAttribute("aria-expanded")).toBe("true")
  })

  it("a nested level waiting for its delay never opens once its parent closed", async () => {
    const { env, user } = fakeTime()
    render(<Menu nested />)
    const menu = getNavigationMenu(env()).via("pointer")
    await menu.hover("Products")
    await menu.hoverTrigger("More")
    await user.keyboard("{Escape}")
    await advance(1000)
    const more = screen.getByRole("button", { name: "More", hidden: true })
    expect(more.getAttribute("aria-expanded")).toBe("false")
  })

  it.skipIf(navigator.userAgent.includes("jsdom"))(
    "grace area: a diagonal move towards the open panel across another trigger keeps it",
    async () => {
      const { user } = fakeTime()
      const log: string[] = []
      render(<Menu wide onValueChange={(v, d) => log.push(`${v} ${d.reason}`)} />)
      const products = trigger("Products")
      const resources = trigger("Resources")
      // Open Resources by hover; its panel spans the bar from the left (wide fixture).
      await user.pointer({ target: resources, coords: centre(resources) })
      await advance(200)
      expect(resources.getAttribute("aria-expanded")).toBe("true")
      const p = products.getBoundingClientRect()
      const r = resources.getBoundingClientRect()
      // Leave Resources by its inline-start edge, heading down-left over Products.
      for (const [x, y] of [
        [r.left + 2, r.top + r.height / 2],
        // The gap between the triggers: the pointer is now in transit towards the panel.
        [r.left - 6, r.top + r.height * 0.75],
        // Over Products' lower edge, still heading for the panel below.
        [p.right - 3, p.bottom - 1],
      ] as const) {
        await user.pointer({
          target: document.elementFromPoint(x, y) ?? document.body,
          coords: { clientX: x, clientY: y },
        })
        await advance(50)
      }
      expect(log).toEqual(["resources trigger-hover"])
      expect(resources.getAttribute("aria-expanded")).toBe("true")
      expect(products.getAttribute("aria-expanded")).toBe("false")
    },
  )
})

describe("NavigationMenu: bar links and the current page", () => {
  it("a press on a bar link closes with link-activate; a modifier click keeps it open", async () => {
    const { user } = fakeTime()
    const onValueChange = vi.fn()
    render(<Menu onValueChange={onValueChange} />)
    const pricing = screen.getByRole("link", { name: "Pricing" })
    // The modifier click would open a tab: jsdom cannot.
    const stay = (e: Event) => e.preventDefault()
    pricing.addEventListener("click", stay)
    await user.click(trigger("Products"))
    await user.keyboard("{Meta>}{Control>}")
    await user.click(pricing)
    await user.keyboard("{/Control}{/Meta}")
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("true")
    pricing.removeEventListener("click", stay)
    await user.click(pricing)
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("false")
    expect(onValueChange.mock.calls.at(-1)?.[1]).toMatchObject({ reason: "link-activate" })
  })

  it("a current link deep in a nested level marks every ancestor trigger", () => {
    render(<Menu nested currentLabs />)
    expect(trigger("Products").hasAttribute("data-current")).toBe(true)
    const more = screen.getByRole("button", { name: "More", hidden: true })
    expect(more.hasAttribute("data-current")).toBe(true)
  })
})

describe("NavigationMenu: a Positioner per item", () => {
  it("each item's positioner has its own id and is shown only while its item is open", async () => {
    const { user } = fakeTime()
    render(<Menu itemPositioners />)
    await user.click(trigger("Products"))
    const positioners = document.querySelectorAll<HTMLElement>('[data-part="positioner"]')
    expect(positioners).toHaveLength(2)
    const [a, b] = positioners
    expect(a?.id).not.toBe(b?.id)
    expect(a?.hidden).toBe(false)
    expect(b?.hidden).toBe(true)
    expect(a?.getAttribute("data-state")).toBe("open")
    expect(b?.getAttribute("data-state")).toBe("closed")
  })

  it("an item's Positioner unmounting leaves the other items positioned", async () => {
    const { user } = fakeTime()
    const Two = ({ both }: { both: boolean }) => (
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="products">
            <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
            <NavigationMenu.Positioner>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="/analytics">Analytics</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Positioner>
          </NavigationMenu.Item>
          <NavigationMenu.Item value="resources">
            <NavigationMenu.Trigger>Resources</NavigationMenu.Trigger>
            {both ? (
              <NavigationMenu.Positioner>
                <NavigationMenu.Content>
                  <NavigationMenu.Link href="/blog">Blog</NavigationMenu.Link>
                </NavigationMenu.Content>
              </NavigationMenu.Positioner>
            ) : (
              <NavigationMenu.Content>
                <NavigationMenu.Link href="/blog">Blog</NavigationMenu.Link>
              </NavigationMenu.Content>
            )}
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    )
    const view = render(<Two both />)
    view.rerender(<Two both={false} />)
    await user.click(trigger("Products"))
    const positioner = document.querySelector<HTMLElement>('[data-part="positioner"]')
    await waitFor(() => expect(positioner?.hasAttribute("data-placing")).toBe(false))
  })
})

describe("NavigationMenu: nested levels and links", () => {
  it("a link in a nested level closes the whole tree", async () => {
    const { user } = fakeTime()
    render(<Menu nested />)
    await user.click(trigger("Products"))
    await user.click(trigger("More"))
    expect(trigger("More").getAttribute("aria-expanded")).toBe("true")
    await user.click(screen.getByRole("link", { name: "Labs" }))
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("false")
    const more = screen.getByRole("button", { name: "More", hidden: true })
    expect(more.getAttribute("aria-expanded")).toBe("false")
  })

  it("Escape in a nested level closes only it, then the parent", async () => {
    const { user } = fakeTime()
    render(<Menu nested />)
    await user.click(trigger("Products"))
    trigger("More").focus()
    await user.keyboard("{Enter}")
    screen.getByRole("link", { name: "Labs" }).focus()
    await user.keyboard("{Escape}")
    expect(trigger("More").getAttribute("aria-expanded")).toBe("false")
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("true")
    expect(active()).toBe(trigger("More"))
    await user.keyboard("{Escape}")
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("false")
  })

  it("a modifier click leaves the menu open", async () => {
    const { user } = fakeTime()
    render(<Menu />)
    await user.click(trigger("Products"))
    const link = screen.getByRole("link", { name: "Analytics" })
    link.addEventListener("click", (e) => e.preventDefault())
    await user.keyboard("{Meta>}{Control>}")
    await user.click(link)
    await user.keyboard("{/Control}{/Meta}")
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("true")
  })

  it("an outside press closes; a press inside the panel does not", async () => {
    const { user } = fakeTime()
    render(<Menu />)
    await user.click(trigger("Products"))
    await user.click(screen.getByRole("textbox", { name: "Search products" }))
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("true")
    await user.click(document.body)
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("false")
  })
})

describe("NavigationMenu: controlled", () => {
  it("defaultValue opens without onValueChange", () => {
    const onValueChange = vi.fn()
    render(<Menu defaultValue="resources" onValueChange={onValueChange} />)
    expect(trigger("Resources").getAttribute("aria-expanded")).toBe("true")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("a refusing parent keeps the menu as it was", async () => {
    const { user } = fakeTime()
    render(<Menu value={null} onValueChange={() => {}} />)
    await user.click(trigger("Products"))
    expect(trigger("Products").getAttribute("aria-expanded")).toBe("false")
  })
})
