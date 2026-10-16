// Avatar scenarios that need no image to load (openspec avatar, image-loading-status): names,
// decorative avatars, groups, attributes, messages. Runs in jsdom and in real browsers; the
// load statuses are in avatar.browser.test.tsx (jsdom never loads images).
import { Avatar, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getAvatar, recordingAnnouncer } from "../index"

afterEach(() => vi.restoreAllMocks())

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

describe("Avatar names", () => {
  it("minimal avatar: exactly one img, named by Root", async () => {
    render(
      <Avatar.Root aria-label="Ada Lovelace">
        <Avatar.Image />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    )
    expect(screen.getAllByRole("img")).toHaveLength(1)
    const a = getAvatar(screen, { name: "Ada Lovelace" })
    expect(await a.name()).toBe("Ada Lovelace")
    expect(await a.status()).toBe("idle")
    expect(await a.isFallbackVisible()).toBe(true)
    expect(screen.queryByRole("img", { name: "AL" })).toBeNull()
    await a11y()
  })

  it("inside a button: the button is named by the avatar", () => {
    render(
      <button type="button">
        <Avatar.Root aria-label="Ada Lovelace">
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </button>,
    )
    expect(screen.getByRole("button", { name: "Ada Lovelace" })).toBeTruthy()
  })

  it("unnamed avatar: a development error asks for a name or aria-hidden", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <Avatar.Root>
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    )
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/aria-label.*aria-hidden="true"/))
  })

  it("decorative avatar beside the name: the name is in the tree once", async () => {
    const error = vi.spyOn(console, "error")
    render(
      <p data-testid="msg">
        <Avatar.Root aria-hidden="true">
          <Avatar.Image alt="" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
        Ada Lovelace
      </p>,
    )
    expect(screen.queryByRole("img")).toBeNull()
    const a = getAvatar(screen, { within: screen.getByTestId("msg") })
    expect(await a.status()).toBe("idle")
    expect(error).not.toHaveBeenCalled()
    await a11y()
  })
})

describe("image without a source", () => {
  it("no src: idle, <img> hidden with no src attribute, Fallback data-state idle", () => {
    const { container } = render(
      <Avatar.Root aria-label="Ada Lovelace">
        <Avatar.Image />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    )
    const img = container.querySelector("img") as HTMLImageElement
    expect(img.hasAttribute("src")).toBe(false)
    expect(img.hidden).toBe(true)
    expect(img.getAttribute("alt")).toBe("")
    for (const part of ["root", "image", "fallback"]) {
      expect(container.querySelector(`[data-part="${part}"]`)?.getAttribute("data-state")).toBe(
        "idle",
      )
    }
  })

  it('empty string src is not written and the status is idle (src="")', async () => {
    const { container } = render(
      <Avatar.Root aria-label="Ada Lovelace">
        <Avatar.Image src="" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>,
    )
    expect(container.querySelector("img")?.hasAttribute("src")).toBe(false)
    expect(await getAvatar(screen, { name: "Ada Lovelace" }).status()).toBe("idle")
  })

  it("attribute order: src after srcSet, sizes and loading", () => {
    const { container } = render(
      <Avatar.Root aria-label="Ada Lovelace">
        <Avatar.Image src="/a.png" loading="lazy" sizes="40px" srcSet="/a.png 1x" />
      </Avatar.Root>,
    )
    const names = [...(container.querySelector("img")?.attributes ?? [])].map((a) => a.name)
    const src = names.indexOf("src")
    for (const other of ["srcset", "sizes", "loading"]) {
      expect(names.indexOf(other)).toBeGreaterThanOrEqual(0)
      expect(names.indexOf(other)).toBeLessThan(src)
    }
  })

  it("a second Image warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Avatar.Root aria-label="Ada Lovelace">
        <Avatar.Image />
        <Avatar.Image />
      </Avatar.Root>,
    )
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/more than one Avatar.Image/))
  })

  it("consumer data-variant, data-size and data-tone pass through", () => {
    const { container } = render(
      <Avatar.Root aria-label="Ada" data-variant="solid" data-size="lg" data-tone="danger">
        <Avatar.Fallback>A</Avatar.Fallback>
      </Avatar.Root>,
    )
    const root = container.querySelector('[data-part="root"]')
    expect(root?.getAttribute("data-variant")).toBe("solid")
    expect(root?.getAttribute("data-size")).toBe("lg")
    expect(root?.getAttribute("data-tone")).toBe("danger")
  })
})

describe("Avatar Group", () => {
  const group = (overflow = <Avatar.GroupOverflow count={4} />) => (
    <Avatar.Group aria-label="Reviewers">
      {["Ada Lovelace", "Alan Turing", "Grace Hopper"].map((n) => (
        <Avatar.Root key={n} aria-label={n}>
          <Avatar.Fallback>{n[0]}</Avatar.Fallback>
        </Avatar.Root>
      ))}
      {overflow}
    </Avatar.Group>
  )

  it('a named group of three images and the text "4 more"', async () => {
    render(group())
    const g = screen.getByRole("group", { name: "Reviewers" })
    expect(g.querySelectorAll('[role="img"]')).toHaveLength(3)
    expect(g.textContent).toContain("4 more")
    const plus = [...g.querySelectorAll('[aria-hidden="true"]')].map((e) => e.textContent)
    expect(plus).toContain("+4")
    await a11y()
  })

  it('overflow rendered as a button is named "4 more"', () => {
    render(group(<Avatar.GroupOverflow count={4} render={<button type="button" />} />))
    expect(screen.getByRole("button", { name: "4 more" })).toBeTruthy()
  })

  it("an unnamed group warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Avatar.Group />)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Avatar.Group needs aria-label/))
  })

  it('localised overflow through the provider: "1 altro"', () => {
    render(
      <RindProvider
        messages={{
          avatar: { overflowLabel: (n: number) => (n === 1 ? "1 altro" : `${n} altri`) },
        }}
      >
        <Avatar.GroupOverflow count={1} render={<button type="button" />} />
      </RindProvider>,
    )
    expect(screen.getByRole("button", { name: "1 altro" })).toBeTruthy()
  })
})

describe("not a live region", () => {
  it("no part is a live region and nothing is announced", async () => {
    const { announcer, log } = recordingAnnouncer()
    const { container } = render(
      <RindProvider announcer={announcer}>
        <Avatar.Root aria-label="Ada Lovelace">
          <Avatar.Image src="/missing.png" />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </RindProvider>,
    )
    expect(container.querySelector("[aria-live], [role=status], [role=alert]")).toBeNull()
    expect(log).toEqual([])
  })
})

describe("jsdom", () => {
  it.runIf(navigator.userAgent.includes("jsdom"))(
    "never loads images: a source stays loading (statuses beyond idle need a real browser)",
    async () => {
      render(
        <Avatar.Root aria-label="Ada Lovelace">
          <Avatar.Image src="/a.png" />
        </Avatar.Root>,
      )
      expect(await getAvatar(screen, { name: "Ada Lovelace" }).status()).toBe("loading")
    },
  )
})
