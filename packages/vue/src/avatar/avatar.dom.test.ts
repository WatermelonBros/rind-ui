// Avatar and Image: React's contract models against the Vue parts, the status classes (load
// statuses in a real browser only), and markup parity with @rind-ui/react.
import { avatarContract, imageContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getAvatar, getImage, recordingAnnouncer, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Avatar, Image, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const inBrowser = !navigator.userAgent.includes("jsdom")
const DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
const missing = () => `/missing-avatar.png?${Math.random()}`

const ada = (src?: string, delay = 0) =>
  h(Avatar.Root, { "aria-label": "Ada Lovelace", fallbackDelay: delay }, () => [
    h(Avatar.Image, src === undefined ? {} : { src }),
    h(Avatar.Fallback, null, () => "AL"),
  ])
const bike = (src?: string) =>
  h(Image.Root, { alt: "A red bicycle" }, () => [
    h(Image.Img, src === undefined ? {} : { src }),
    h(Image.Fallback, null, () => "Image unavailable"),
  ])

describe("vue avatar model", () => {
  testMachine(avatarContract, {
    test: it,
    setup: () => mount(() => ada()),
    target: () => screen,
    anchor: [{ name: "Ada Lovelace" }] as never,
    props: { fallbackDelay: undefined, onStatusChange: undefined } as never,
    a11y,
  })
})

describe("vue image model", () => {
  testMachine(imageContract, {
    test: it,
    setup: () => mount(() => bike()),
    target: () => screen,
    anchor: [{ name: "A red bicycle" }] as never,
    props: { fallbackDelay: undefined, onStatusChange: undefined } as never,
    a11y,
  })
})

describe("vue avatar and image statuses", () => {
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
        mount(() => h(RindProvider, { announcer }, () => [ada(c.src, c.delay), bike(c.src)]))
        const a = getAvatar(screen, { name: "Ada Lovelace" })
        await a.waitForStatus(c.status)
        expect(await a.name()).toBe("Ada Lovelace")
        expect(await a.isFallbackVisible()).toBe(c.status !== "loaded")
        const i = getImage(screen, { name: "A red bicycle" })
        await i.waitForStatus(c.status)
        expect(log).toEqual([])
        await a11y()
      },
    )
  }
})

describe("Vue Avatar and Image match React", () => {
  it("idle, decorative, group with overflow", async () => {
    const reactAda = r(
      R.Avatar.Root,
      { "aria-label": "Ada Lovelace" },
      r(R.Avatar.Image),
      r(R.Avatar.Fallback, null, "AL"),
    )
    await serverParity(reactAda, () => ada())
    await clientParity(reactAda, () => ada())
    const reactBike = r(
      R.Image.Root,
      { alt: "A red bicycle" },
      r(R.Image.Img),
      r(R.Image.Fallback, null, "Image unavailable"),
    )
    await serverParity(reactBike, () => bike())
    await clientParity(reactBike, () => bike())
    const group = r(
      R.Avatar.Group,
      { "aria-label": "Team" },
      r(R.Avatar.Root, { "aria-label": "Ada" }, r(R.Avatar.Fallback, null, "A")),
      r(R.Avatar.GroupOverflow, { count: 3 }),
    )
    const vueGroup = () =>
      h(Avatar.Group, { "aria-label": "Team" }, () => [
        h(Avatar.Root, { "aria-label": "Ada" }, () => h(Avatar.Fallback, null, () => "A")),
        h(Avatar.GroupOverflow, { count: 3 }),
      ])
    await serverParity(group, vueGroup)
    await clientParity(group, vueGroup)
  })
})
