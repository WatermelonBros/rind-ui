// Avatar and Image: React's contract models against the Svelte parts, the status classes
// (load statuses in a real browser only), and DOM parity with @rind-ui/react.
import { avatarContract, imageContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getAvatar, getImage, recordingAnnouncer, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import People from "../../fixtures/avatar/people.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

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

describe("svelte avatar model", () => {
  testMachine(avatarContract, {
    test: it,
    setup: () => mount(People, { show: "avatar" }),
    target: () => screen,
    anchor: [{ name: "Ada Lovelace" }] as never,
    props: { fallbackDelay: undefined, onStatusChange: undefined } as never,
    a11y,
  })
})

describe("svelte image model", () => {
  testMachine(imageContract, {
    test: it,
    setup: () => mount(People, { show: "image" }),
    target: () => screen,
    anchor: [{ name: "A red bicycle" }] as never,
    props: { fallbackDelay: undefined, onStatusChange: undefined } as never,
    a11y,
  })
})

describe("svelte avatar and image statuses", () => {
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
        mount(People, { ...(c.src === undefined ? {} : { src: c.src }), delay: c.delay, announcer })
        const a = getAvatar(screen, { name: "Ada Lovelace" })
        await a.waitForStatus(c.status)
        expect(await a.name()).toBe("Ada Lovelace")
        expect(await a.isFallbackVisible()).toBe(c.status !== "loaded")
        await getImage(screen, { name: "A red bicycle" }).waitForStatus(c.status)
        expect(log).toEqual([])
        await a11y()
      },
    )
  }
})

describe("Svelte Avatar and Image match React", () => {
  it("idle and group with overflow", async () => {
    await clientParity(
      r(
        R.RindProvider,
        null,
        r(
          R.Avatar.Root,
          { "aria-label": "Ada Lovelace" },
          r(R.Avatar.Image),
          r(R.Avatar.Fallback, null, "AL"),
        ),
        r(
          R.Image.Root,
          { alt: "A red bicycle" },
          r(R.Image.Img),
          r(R.Image.Fallback, null, "Image unavailable"),
        ),
      ),
      People,
      {},
    )
    await clientParity(
      r(
        R.Avatar.Group,
        { "aria-label": "Team" },
        r(R.Avatar.Root, { "aria-label": "Ada" }, r(R.Avatar.Fallback, null, "A")),
        r(R.Avatar.GroupOverflow, { count: 3 }),
      ),
      People,
      { show: "group" },
    )
  })
})
