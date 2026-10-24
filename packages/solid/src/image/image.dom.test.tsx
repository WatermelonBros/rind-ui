/** @jsxImportSource solid-js */
// Image: React's contract model against the Solid parts, the status classes (load statuses in a
// real browser only), and markup parity with @rind-ui/react.
import { imageContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getImage, recordingAnnouncer, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Image, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const inBrowser = !navigator.userAgent.includes("jsdom")
const DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
const missing = () => `/missing-image.png?${Math.random()}`

const bike = (src?: string, delay = 0) => (
  <Image.Root alt="A red bicycle" fallbackDelay={delay}>
    <Image.Img src={src} />
    <Image.Fallback>Image unavailable</Image.Fallback>
  </Image.Root>
)

describe("solid image model", () => {
  testMachine(imageContract, {
    test: it,
    setup: () => mount(() => bike()),
    target: () => screen,
    anchor: [{ name: "A red bicycle" }] as never,
    props: { fallbackDelay: undefined, onStatusChange: undefined } as never,
    a11y,
  })
})

describe("solid image statuses", () => {
  const classes = {
    "no source": { src: undefined, status: "idle", delay: 0 },
    "data URL": { src: DATA, status: "loaded", delay: 0 },
    "404 source": { src: missing(), status: "error", delay: 0 },
    "404 source, fallbackDelay 300": { src: missing(), status: "error", delay: 300 },
  } as const
  for (const [name, c] of Object.entries(classes)) {
    it.runIf(inBrowser || c.status === "idle")(
      `${name}: ${c.status}, same name, silent, axe`,
      async () => {
        const { announcer, log } = recordingAnnouncer()
        mount(() => <RindProvider announcer={announcer}>{bike(c.src, c.delay)}</RindProvider>)
        const i = getImage(screen, { name: "A red bicycle" })
        await i.waitForStatus(c.status)
        expect(await i.isFallbackVisible()).toBe(c.status !== "loaded")
        expect(log).toEqual([])
        await a11y()
      },
    )
  }
})

describe("Solid Image matches React", () => {
  it("idle, with a fallback", async () => {
    await clientParity(
      r(
        R.Image.Root,
        { alt: "A red bicycle" },
        r(R.Image.Img),
        r(R.Image.Fallback, null, "Image unavailable"),
      ),
      () => bike(),
    )
  })
})
