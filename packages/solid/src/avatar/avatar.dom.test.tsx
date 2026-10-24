/** @jsxImportSource solid-js */
// Avatar: React's contract model against the Solid parts, the status classes (load statuses in a
// real browser only), and markup parity with @rind-ui/react.
import { avatarContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getAvatar, recordingAnnouncer, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Avatar, RindProvider } from "../index"

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

const ada = (src?: string, delay = 0) => (
  <Avatar.Root aria-label="Ada Lovelace" fallbackDelay={delay}>
    <Avatar.Image src={src} />
    <Avatar.Fallback>AL</Avatar.Fallback>
  </Avatar.Root>
)

describe("solid avatar model", () => {
  testMachine(avatarContract, {
    test: it,
    setup: () => mount(() => ada()),
    target: () => screen,
    anchor: [{ name: "Ada Lovelace" }] as never,
    props: { fallbackDelay: undefined, onStatusChange: undefined } as never,
    a11y,
  })
})

describe("solid avatar statuses", () => {
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
        mount(() => <RindProvider announcer={announcer}>{ada(c.src, c.delay)}</RindProvider>)
        const a = getAvatar(screen, { name: "Ada Lovelace" })
        await a.waitForStatus(c.status)
        expect(await a.name()).toBe("Ada Lovelace")
        expect(await a.isFallbackVisible()).toBe(c.status !== "loaded")
        expect(log).toEqual([])
        await a11y()
      },
    )
  }
})

describe("Solid Avatar matches React", () => {
  it("idle, group with overflow", async () => {
    await clientParity(
      r(
        R.Avatar.Root,
        { "aria-label": "Ada Lovelace" },
        r(R.Avatar.Image),
        r(R.Avatar.Fallback, null, "AL"),
      ),
      () => ada(),
    )
    await clientParity(
      r(
        R.Avatar.Group,
        { "aria-label": "Team" },
        r(R.Avatar.Root, { "aria-label": "Ada" }, r(R.Avatar.Fallback, null, "A")),
        r(R.Avatar.GroupOverflow, { count: 3 }),
      ),
      () => (
        <Avatar.Group aria-label="Team">
          <Avatar.Root aria-label="Ada">
            <Avatar.Fallback>A</Avatar.Fallback>
          </Avatar.Root>
          <Avatar.GroupOverflow count={3} />
        </Avatar.Group>
      ),
    )
  })
})
