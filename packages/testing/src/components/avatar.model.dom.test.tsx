// Model-based coverage for Avatar (task 5.1). Every image event comes from the network, so
// the contract maps them to browser-fixture skips and the runner reports them; the props
// classes below then check the invariants per status: the name is the same in every status,
// nothing is announced, axe passes. Load statuses need a real browser (jsdom never loads).
import { avatarContract } from "@rind-ui/core"
import { Avatar, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { getAvatar, recordingAnnouncer, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

describe("avatar model", () => {
  testMachine(avatarContract, {
    test: it,
    setup: () =>
      render(
        <Avatar.Root aria-label="Ada Lovelace">
          <Avatar.Image />
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>,
      ),
    target: () => screen,
    anchor: [{ name: "Ada Lovelace" }] as never,
    props: { fallbackDelay: undefined, onStatusChange: undefined } as never,
    a11y,
  })
})

const inBrowser = !navigator.userAgent.includes("jsdom")
const DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

describe("avatar props classes: invariants per status", () => {
  const classes = {
    "no source": { src: undefined, status: "idle", delay: 0 },
    "data URL": { src: DATA, status: "loaded", delay: 0 },
    "404 source": { src: `/missing-avatar.png?${Math.random()}`, status: "error", delay: 0 },
    "404 source, fallbackDelay 300": {
      src: `/missing-avatar.png?${Math.random()}`,
      status: "error",
      delay: 300,
    },
  } as const
  for (const [name, c] of Object.entries(classes)) {
    it.runIf(inBrowser || c.status === "idle")(
      `${name}: ${c.status}, same name, silent, axe`,
      async () => {
        const { announcer, log } = recordingAnnouncer()
        render(
          <RindProvider announcer={announcer}>
            <Avatar.Root aria-label="Ada Lovelace" fallbackDelay={c.delay}>
              <Avatar.Image src={c.src} />
              <Avatar.Fallback>AL</Avatar.Fallback>
            </Avatar.Root>
          </RindProvider>,
        )
        const a = getAvatar(screen, { name: "Ada Lovelace" })
        await a.waitForStatus(c.status)
        expect(await a.name()).toBe("Ada Lovelace")
        expect(await a.isFallbackVisible()).toBe(c.status !== "loaded")
        expect(log).toEqual([])
        await a11y()
      },
    )
  }

  it("decorative: nothing exposed, axe", async () => {
    render(
      <div data-testid="row">
        <Avatar.Root aria-hidden="true">
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
        Ada Lovelace
      </div>,
    )
    expect(screen.queryByRole("img")).toBeNull()
    expect(await getAvatar(screen, { within: screen.getByTestId("row") }).status()).toBe("idle")
    await a11y()
  })
})
