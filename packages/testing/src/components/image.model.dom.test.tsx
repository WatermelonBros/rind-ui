// Model-based coverage for Image (task 5.1). Every image event comes from the network, so the
// contract maps them to browser-fixture skips; the props classes below then check the spec's
// invariants per status, named and decorative: exactly one exposed `img` named `alt` (zero
// decorative), on the <img> in loading/loaded and on Root in idle/error, the <img> hidden
// exactly in idle/error, nothing announced, axe (image-alt, role-img-alt). Load statuses need
// a real browser (jsdom never loads images).
import { imageContract } from "@rind-ui/core"
import { Image, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { getImage, recordingAnnouncer, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

describe("image model", () => {
  testMachine(imageContract, {
    test: it,
    setup: () =>
      render(
        <Image.Root alt="A red bicycle">
          <Image.Img />
          <Image.Fallback>Image unavailable</Image.Fallback>
        </Image.Root>,
      ),
    target: () => screen,
    anchor: [{ name: "A red bicycle" }] as never,
    props: { fallbackDelay: undefined, onStatusChange: undefined } as never,
    a11y,
  })
})

const inBrowser = !navigator.userAgent.includes("jsdom")
const DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

/** The spec's per-step invariants for one Image in `container`. */
function invariants(container: HTMLElement, alt: string, status: string) {
  const exposed = [
    ...container.querySelectorAll<HTMLElement>('img:not([hidden]):not([alt=""]), [role="img"]'),
  ]
  const img = container.querySelector("img") as HTMLImageElement
  if (alt === "") {
    expect(exposed).toEqual([])
  } else {
    expect(exposed).toHaveLength(1)
    const gone = status === "idle" || status === "error"
    expect(exposed[0]?.getAttribute("data-part")).toBe(gone ? "root" : "img")
  }
  expect(img.hidden).toBe(status === "idle" || status === "error")
}

describe("image props classes: invariants per status", () => {
  const classes = {
    "no source": { src: undefined, status: "idle" },
    "data URL": { src: DATA, status: "loaded" },
    "failing source": { src: `/missing-image.png?${Math.random()}`, status: "error" },
  } as const
  for (const [name, c] of Object.entries(classes)) {
    for (const alt of ["A red bicycle", ""]) {
      it.runIf(inBrowser || c.status === "idle")(
        `${name}, ${alt ? "named" : "decorative"}: ${c.status}, invariants, silent, axe`,
        async () => {
          const { announcer, log } = recordingAnnouncer()
          const { container } = render(
            <RindProvider announcer={announcer}>
              <div data-testid="host">
                <Image.Root alt={alt}>
                  <Image.Img src={c.src} />
                  <Image.Fallback>Image unavailable</Image.Fallback>
                </Image.Root>
              </div>
            </RindProvider>,
          )
          const i = alt
            ? getImage(screen, { name: alt })
            : getImage(screen, { within: screen.getByTestId("host") })
          await i.waitForStatus(c.status)
          invariants(container, alt, c.status)
          if (alt) expect(await i.name()).toBe(alt)
          expect(log).toEqual([])
          await a11y()
        },
      )
    }
  }

  it("a wrapper that empties Root's aria-label fails in error, naming Root", async () => {
    // The broken wrapper's override, passed the way a wrapper spreads its props.
    const broken = { "aria-label": "" }
    render(
      <Image.Root alt="A red bicycle" {...broken}>
        <Image.Img />
      </Image.Root>,
    )
    const root = document.querySelector('[data-part="root"]') as HTMLElement
    // Root is the named element in idle/error: an empty label breaks the invariant there.
    expect(root.getAttribute("role")).toBe("img")
    expect(root.getAttribute("aria-label")).toBe("")
    await expect(a11y()).rejects.toThrow(/role-img-alt/)
  })
})
