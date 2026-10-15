// Heading scenarios through the heading driver (openspec heading).
import { Heading, Portal, useHeadingLevel } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { type ReactNode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getHeading } from "../index"

afterEach(() => vi.restoreAllMocks())
const warn = () => vi.spyOn(console, "warn").mockImplementation(() => {})
const tag = (name: string) => screen.getByText(name).tagName

describe("Heading", () => {
  it("default heading is an h2 without role or aria-level", () => {
    render(<Heading>Settings</Heading>)
    const el = screen.getByRole("heading", { name: "Settings" })
    expect(el.tagName).toBe("H2")
    expect(el.hasAttribute("role")).toBe(false)
    expect(el.hasAttribute("aria-level")).toBe(false)
  })

  it("nested sections are h2 / h3 / h4", async () => {
    render(
      <>
        <Heading>Settings</Heading>
        <Heading.Level>
          <Heading>Profile</Heading>
          <Heading.Level>
            <Heading>Avatar</Heading>
          </Heading.Level>
        </Heading.Level>
      </>,
    )
    expect(tag("Settings")).toBe("H2")
    expect(tag("Profile")).toBe("H3")
    expect(tag("Avatar")).toBe("H4")
    expect(await getHeading(screen, { name: "Profile" }).level()).toBe(3)
  })

  it("anchored page root: h1 then h2", () => {
    render(
      <Heading.Level level={1}>
        <Heading>Dashboard</Heading>
        <Heading.Level>
          <Heading>Usage</Heading>
        </Heading.Level>
      </Heading.Level>,
    )
    expect(tag("Dashboard")).toBe("H1")
    expect(tag("Usage")).toBe("H2")
  })

  it("portalled content keeps the tree level (mui/base-ui#1678)", () => {
    render(
      <Heading.Level level={3}>
        <Portal>
          <Heading>Portalled</Heading>
        </Portal>
      </Heading.Level>,
    )
    const el = screen.getByText("Portalled")
    expect(el.tagName).toBe("H3")
    expect(document.body.lastElementChild?.contains(el)).toBe(true)
  })

  it("an explicit level wins over the section", () => {
    render(
      <Heading.Level level={4}>
        <Heading level={2}>Explicit</Heading>
      </Heading.Level>,
    )
    expect(tag("Explicit")).toBe("H2")
  })

  it("too deep renders h6 and warns exactly once, even after re-renders", () => {
    const w = warn()
    const Deep = ({ children }: { children: ReactNode }) => (
      <Heading.Level>
        <Heading.Level>
          <Heading.Level>
            <Heading.Level>
              <Heading.Level>{children}</Heading.Level>
            </Heading.Level>
          </Heading.Level>
        </Heading.Level>
      </Heading.Level>
    )
    const { rerender } = render(
      <Deep>
        <Heading>Deep</Heading>
      </Deep>,
    )
    expect(tag("Deep")).toBe("H6")
    for (let i = 0; i < 3; i++)
      rerender(
        <Deep>
          <Heading data-n={i}>Deep</Heading>
        </Deep>,
      )
    const deepWarns = w.mock.calls.filter((c) => String(c[0]).includes("deep"))
    expect(deepWarns).toHaveLength(1)
  })

  it("substituted with a div: role heading and aria-level", () => {
    render(
      <Heading.Level>
        <Heading render={<div />}>Div</Heading>
      </Heading.Level>,
    )
    const el = screen.getByText("Div")
    expect(el.tagName).toBe("DIV")
    expect(el.getAttribute("role")).toBe("heading")
    expect(el.getAttribute("aria-level")).toBe("3")
  })

  it("styled with another native heading: aria-level, no role", async () => {
    render(
      // biome-ignore lint/a11y/useHeadingContent: Heading supplies the children
      <Heading render={<h4 />} level={2}>
        Styled
      </Heading>,
    )
    const el = screen.getByText("Styled")
    expect(el.tagName).toBe("H4")
    expect(el.getAttribute("aria-level")).toBe("2")
    expect(el.hasAttribute("role")).toBe(false)
    expect(await getHeading(screen, { name: "Styled" }).level()).toBe(2)
  })

  it("render as a component gets the right attributes after mount", () => {
    const Five = (props: React.ComponentProps<"h5">) => <h5 {...props} />
    render(
      <Heading level={2} render={<Five />}>
        Comp
      </Heading>,
    )
    const el = screen.getByText("Comp")
    expect(el.tagName).toBe("H5")
    expect(el.getAttribute("aria-level")).toBe("2")
    expect(el.hasAttribute("role")).toBe(false)
  })

  it("an empty exposed heading warns after mount", () => {
    const w = warn()
    render(<Heading>{""}</Heading>)
    expect(w.mock.calls.some((c) => String(c[0]).includes("empty heading"))).toBe(true)
  })

  it("a heading with aria-label is not empty", () => {
    const w = warn()
    render(<Heading aria-label="Named">{""}</Heading>)
    expect(w).not.toHaveBeenCalled()
  })

  it("a hidden visual heading logs nothing and is not exposed", () => {
    const w = warn()
    render(
      <>
        <Heading aria-hidden="true">March 2026</Heading>
        <span>March 2026 label</span>
      </>,
    )
    expect(w).not.toHaveBeenCalled()
    expect(screen.queryByRole("heading")).toBeNull()
  })

  it("a consumer title using useHeadingLevel() inside a level-3 section is an h3", () => {
    const CardTitle = ({ children }: { children: string }) => {
      const Tag = `h${useHeadingLevel()}` as "h3"
      return <Tag>{children}</Tag>
    }
    render(
      <Heading.Level level={3}>
        <CardTitle>Card</CardTitle>
      </Heading.Level>,
    )
    expect(tag("Card")).toBe("H3")
  })

  it("carries data attributes and forwards consumer data-*", () => {
    render(
      <Heading.Level>
        <Heading data-variant="v" data-size="lg" data-tone="muted" data-custom="x" id="mine">
          Data
        </Heading>
      </Heading.Level>,
    )
    const el = screen.getByText("Data")
    expect(el.getAttribute("data-scope")).toBe("heading")
    expect(el.getAttribute("data-part")).toBe("root")
    expect(el.getAttribute("data-level")).toBe("3")
    expect(el.hasAttribute("data-instance")).toBe(true)
    expect(el.getAttribute("data-variant")).toBe("v")
    expect(el.getAttribute("data-size")).toBe("lg")
    expect(el.getAttribute("data-tone")).toBe("muted")
    expect(el.getAttribute("data-custom")).toBe("x")
    expect(el.id).toBe("mine")
  })

  it("updates the level when the section changes", () => {
    const App = () => {
      const [l, setL] = useState<1 | 3>(1)
      return (
        <Heading.Level level={l}>
          <button type="button" onClick={() => setL(3)}>
            go
          </button>
          <Heading>T</Heading>
        </Heading.Level>
      )
    }
    render(<App />)
    expect(tag("T")).toBe("H1")
    screen.getByText("go").click()
    return vi.waitFor(() => expect(tag("T")).toBe("H3"))
  })
})

describe("getHeading", () => {
  it("fails listing every match when two headings share a name", async () => {
    render(
      <>
        <Heading>Twin</Heading>
        <Heading.Level>
          <Heading>Twin</Heading>
        </Heading.Level>
      </>,
    )
    await expect(getHeading(screen, { name: "Twin" }).level()).rejects.toThrow(/2 elements match/)
  })

  it("fails when nothing matches", async () => {
    render(<Heading>One</Heading>)
    await expect(getHeading(screen, { name: "Nope" }).level()).rejects.toThrow()
  })
})
