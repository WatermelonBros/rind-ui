// Avatar and Image: React's contract models against the Angular parts, the status classes
// (load statuses in a real browser only), and markup parity with @rind-ui/react.
import { Component } from "@angular/core"
import { avatarContract, imageContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getAvatar, getImage, recordingAnnouncer, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Image } from "../image/image"
import { provideRind } from "../provider"
import { Avatar } from "./avatar"

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

/** The source and delay the next fixture renders with. */
let current: { src?: string; delay: number } = { delay: 0 }

@Component({
  selector: "rind-f",
  imports: [Avatar],
  template: `<span rindAvatarRoot aria-label="Ada Lovelace" [fallbackDelay]="delay">
    <img rindAvatarImage [src]="src" /><span rindAvatarFallback>AL</span>
  </span>`,
})
class Ada {
  readonly src = current.src
  readonly delay = current.delay
}
@Component({
  selector: "rind-f",
  imports: [Image],
  template: `<span rindImageRoot alt="A red bicycle">
    <img rindImageImg [src]="src" /><span rindImageFallback>Image unavailable</span>
  </span>`,
})
class Bike {
  readonly src = current.src
}
describe("angular avatar model", () => {
  testMachine(avatarContract, {
    test: it,
    setup: () => {
      current = { delay: 0 }
      return mount(Ada)
    },
    target: () => screen,
    anchor: [{ name: "Ada Lovelace" }] as never,
    props: { fallbackDelay: undefined, onStatusChange: undefined } as never,
    a11y,
  })
})

describe("angular image model", () => {
  testMachine(imageContract, {
    test: it,
    setup: () => {
      current = { delay: 0 }
      return mount(Bike)
    },
    target: () => screen,
    anchor: [{ name: "A red bicycle" }] as never,
    props: { fallbackDelay: undefined, onStatusChange: undefined } as never,
    a11y,
  })
})

describe("angular avatar and image statuses", () => {
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
        current = { ...(c.src === undefined ? {} : { src: c.src }), delay: c.delay }
        await mount(Ada, {}, [provideRind({ announcer })])
        await mount(Bike, {}, [provideRind({ announcer })])
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

@Component({
  selector: "rind-f",
  imports: [Avatar],
  template: `<div rindAvatarGroup aria-label="Team">
    <span rindAvatarRoot aria-label="Ada"><span rindAvatarFallback>A</span></span>
    <span rindAvatarGroupOverflow [count]="3"></span>
  </div>`,
})
class Group {}

describe("Angular Avatar and Image match React", () => {
  it("idle, decorative, group with overflow", async () => {
    current = { delay: 0 }
    await both(
      r(
        R.Avatar.Root,
        { "aria-label": "Ada Lovelace" },
        r(R.Avatar.Image),
        r(R.Avatar.Fallback, null, "AL"),
      ),
      Ada,
    )
    await both(
      r(
        R.Image.Root,
        { alt: "A red bicycle" },
        r(R.Image.Img),
        r(R.Image.Fallback, null, "Image unavailable"),
      ),
      Bike,
    )
    await both(
      r(
        R.Avatar.Group,
        { "aria-label": "Team" },
        r(R.Avatar.Root, { "aria-label": "Ada" }, r(R.Avatar.Fallback, null, "A")),
        r(R.Avatar.GroupOverflow, { count: 3 }),
      ),
      Group,
    )
  })
})
