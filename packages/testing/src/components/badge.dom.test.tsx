// Badge scenarios through the badge driver (openspec badge): the driver, the host naming
// rules with dom-accessibility-api, the post-mount development checks, the "no live region
// of its own" invariant and axe. Runs in jsdom and in real browsers.
import { Badge, VisuallyHidden } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { computeAccessibleDescription, computeAccessibleName } from "dom-accessibility-api"
import { cloneElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { collectDom } from "../collect"
import { getBadge } from "../index"
import { genericInvariants, type StepFacts } from "../invariants"

afterEach(() => vi.restoreAllMocks())

const warnings = () => vi.spyOn(console, "warn").mockImplementation(() => {})
const badgeWarnings = (w: ReturnType<typeof warnings>) =>
  w.mock.calls.map((c) => String(c[0])).filter((m) => m.includes("badge:"))

const a11y = async (disable: readonly string[] = []) => {
  const { violations } = await axe.run(document.body, {
    rules: {
      region: { enabled: false },
      "color-contrast": { enabled: false },
      ...Object.fromEntries(disable.map((id) => [id, { enabled: false }])),
    },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

describe("getBadge", () => {
  it("reads the spoken text: the label (mui/material-ui#22070)", async () => {
    render(
      <button type="button" data-testid="host">
        <Badge.Root label="3 unread">3</Badge.Root>
      </button>,
    )
    const b = getBadge(screen, { within: screen.getByTestId("host") })
    expect(await b.text()).toBe("3 unread")
    expect(await b.isExposed()).toBe(true)
  })

  it("reads the text content without a label", async () => {
    render(
      <div data-testid="box">
        <Badge.Root>Beta</Badge.Root>
      </div>,
    )
    expect(await getBadge(screen, { within: screen.getByTestId("box") }).text()).toBe("Beta")
  })

  it("a hidden badge has no text and is not exposed", async () => {
    render(
      <div data-testid="box">
        <Badge.Root aria-hidden="true">2</Badge.Root>
      </div>,
    )
    const b = getBadge(screen, { within: screen.getByTestId("box") })
    expect(await b.text()).toBe("")
    expect(await b.isExposed()).toBe(false)
  })

  it("several matches fail listing every match", async () => {
    render(
      <div data-testid="box">
        <Badge.Root>1</Badge.Root>
        <Badge.Root>2</Badge.Root>
      </div>,
    )
    await expect(getBadge(screen, { within: screen.getByTestId("box") }).text()).rejects.toThrow(
      /2 elements match/,
    )
  })
})

describe("Never a live region", () => {
  it("count changes silently: no live role or attribute (Kobalte role=status)", () => {
    const { rerender, container } = render(<Badge.Root>3</Badge.Root>)
    rerender(<Badge.Root>4</Badge.Root>)
    const el = container.querySelector('[data-scope="badge"]')
    expect(el?.textContent).toBe("4")
    for (const a of ["role", "aria-live", "aria-atomic", "aria-relevant", "tabindex"]) {
      expect(el?.hasAttribute(a)).toBe(false)
    }
  })

  it("a wrapper adding role=status warns and fails the rule-23 invariant", () => {
    const w = warnings()
    render(
      <Badge.Root id="b" role="status">
        3
      </Badge.Root>,
    )
    expect(badgeWarnings(w).join("\n")).toMatch(/never a live region/)
    const after = collectDom({ scope: "badge", instance: "b" })
    // Only `traits` and `after` are read by the live-region invariant.
    const facts = { traits: [], after } as unknown as StepFacts
    expect(genericInvariants["live-regions"]?.(facts)).not.toEqual([])
  })
})

describe("Text for assistive technology", () => {
  it("overflowing count: 99+ visible but hidden, label in the tree", () => {
    render(
      <button type="button">
        <Badge.Root label="more than 99 notifications">99+</Badge.Root>
      </button>,
    )
    expect(computeAccessibleName(screen.getByRole("button"))).toBe("more than 99 notifications")
    expect(screen.getByText("99+").closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it("dot badge without text warns (mui/material-ui#49441, adobe/react-spectrum#4043)", () => {
    const w = warnings()
    render(<Badge.Root />)
    expect(badgeWarnings(w).join("\n")).toMatch(/label=|aria-hidden/)
  })

  it("decorative badge: nothing exposed, nothing logged", () => {
    const w = warnings()
    render(
      <button type="button" aria-label="Comments, 2 unread">
        <Badge.Root aria-hidden="true">2</Badge.Root>
      </button>,
    )
    expect(computeAccessibleName(screen.getByRole("button"))).toBe("Comments, 2 unread")
    expect(badgeWarnings(w)).toEqual([])
  })

  it("aria-label on the root warns and recommends label", () => {
    const w = warnings()
    render(<Badge.Root aria-label="3 unread">3</Badge.Root>)
    expect(badgeWarnings(w).join("\n")).toMatch(/label prop/)
  })
})

describe("Count on an interactive host", () => {
  it("name from content: 'Comments 3 unread'", async () => {
    const w = warnings()
    render(
      <button type="button">
        <VisuallyHidden>Comments</VisuallyHidden> <Badge.Root label="3 unread">3</Badge.Root>
      </button>,
    )
    expect(computeAccessibleName(screen.getByRole("button"))).toBe("Comments 3 unread")
    expect(badgeWarnings(w)).toEqual([])
    await a11y()
  })

  it("host keeps aria-label and lists the badge in aria-describedby", async () => {
    const w = warnings()
    render(
      <button type="button" aria-label="Comments" aria-describedby="c">
        <Badge.Root id="c" label="3 unread">
          3
        </Badge.Root>
      </button>,
    )
    const button = screen.getByRole("button")
    expect(computeAccessibleName(button)).toBe("Comments")
    expect(computeAccessibleDescription(button)).toBe("3 unread")
    expect(badgeWarnings(w)).toEqual([])
    // WCAG 2.5.3 (label in name): the visible "3" is not in "Comments". The spec allows
    // this host form; it is why the docs lead with name from content.
    await a11y(["label-content-name-mismatch"])
  })

  it("count hidden by the host's label warns naming the host (mui/material-ui#49441)", () => {
    const w = warnings()
    render(
      <button type="button" aria-label="Comments">
        <Badge.Root>3</Badge.Root>
      </button>,
    )
    const [message = ""] = badgeWarnings(w)
    expect(message).toMatch(/<button> named "Comments"/)
    expect(message).toMatch(/aria-describedby/)
  })

  it.each([
    ["tab", <div role="tab" aria-label="Inbox" tabIndex={-1} key="t" />],
    ["menuitem", <div role="menuitem" aria-label="Inbox" tabIndex={-1} key="m" />],
    // biome-ignore lint/a11y/useAnchorContent: the badge is cloned in as its content
    ["link", <a href="#x" aria-label="Inbox" key="a" />],
  ] as const)("also inside a %s", (_, host) => {
    const w = warnings()
    render(cloneElement(host, {}, <Badge.Root>3</Badge.Root>))
    expect(badgeWarnings(w)).toHaveLength(1)
  })

  it("aria-labelledby host whose label text lacks the count warns", () => {
    const w = warnings()
    render(
      <>
        <span id="l">Inbox</span>
        <button type="button" aria-labelledby="l">
          <Badge.Root>5</Badge.Root>
        </button>
      </>,
    )
    expect(badgeWarnings(w)).toHaveLength(1)
  })

  it("label already contains the count: no warning", () => {
    const w = warnings()
    render(
      <button type="button" aria-label="Sync (2 incoming)">
        <Badge.Root>2</Badge.Root>
      </button>,
    )
    expect(badgeWarnings(w)).toEqual([])
  })

  it("badge in a tab and a menu item passes axe", async () => {
    render(
      <>
        <div role="tablist" aria-label="Views">
          <button type="button" role="tab" aria-selected="true">
            Inbox <Badge.Root label="4 new">4</Badge.Root>
          </button>
        </div>
        <div role="menu" aria-label="Actions">
          <div role="menuitem" tabIndex={-1}>
            Updates <Badge.Root data-tone="danger">New</Badge.Root>
          </div>
        </div>
      </>,
    )
    expect(computeAccessibleName(screen.getByRole("tab"))).toBe("Inbox 4 new")
    await a11y()
  })
})

describe("Data attributes", () => {
  it("consumer styling hooks pass through and change no accessibility output", () => {
    render(
      <>
        <button type="button">
          <Badge.Root data-variant="solid" data-tone="danger">
            2
          </Badge.Root>
        </button>
        <button type="button">
          <Badge.Root>2</Badge.Root>
        </button>
      </>,
    )
    const [a, b] = screen.getAllByRole("button")
    const el = a?.firstElementChild
    expect(el?.getAttribute("data-scope")).toBe("badge")
    expect(el?.getAttribute("data-part")).toBe("root")
    expect(el?.hasAttribute("data-instance")).toBe(true)
    expect(el?.getAttribute("data-variant")).toBe("solid")
    expect(el?.getAttribute("data-tone")).toBe("danger")
    expect(computeAccessibleName(a as Element)).toBe(computeAccessibleName(b as Element))
  })
})
