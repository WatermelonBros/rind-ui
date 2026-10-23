// Separator, Badge, Kbd, Toggle and Button: the same DOM as @rind-ui/react.
import * as R from "@rind-ui/react"
import { expectRindWarning } from "@rind-ui/testing"
import { createElement as r } from "react"
import type { Component } from "svelte"
import { describe, it } from "vitest"
import AsChild from "../../fixtures/as-child.svelte"
import { clientParity } from "../../fixtures/parity"
import Render from "../../fixtures/render.svelte"
import Host from "../../fixtures/separator/host.svelte"
import Indicator from "../../fixtures/toggle/indicator.svelte"
import { Badge, Button, Kbd, Separator, Toggle } from "../index"

type Props = Record<string, unknown>
const same = (react: Parameters<typeof clientParity>[0], is: unknown, props: Props = {}) =>
  clientParity(react, Render, { is: is as Component<Props>, ...props })
const child = (react: Parameters<typeof clientParity>[0], is: unknown, props: Props) =>
  clientParity(react, AsChild, { is: is as Component<Props>, ...props } as never)

describe("Svelte matches React", () => {
  it("Separator", async () => {
    await same(r(R.Separator.Root), Separator.Root)
    await same(r(R.Separator.Root, { orientation: "vertical" }), Separator.Root, {
      orientation: "vertical",
    })
    await same(r(R.Separator.Root, { decorative: true }), Separator.Root, { decorative: true })
    await same(r(R.Separator.Root, { "aria-label": "Advanced" }), Separator.Root, {
      "aria-label": "Advanced",
    })
    await same(
      r(R.Separator.Root, { "data-variant": "v", "data-tone": "muted" } as Record<string, string>),
      Separator.Root,
      {
        "data-variant": "v",
        "data-tone": "muted",
      },
    )
    await child(r(R.Separator.Root, { render: r("hr") }), Separator.Root, { tag: "hr" })
    const toolbar = { context: "toolbar", defaultOrientation: "vertical" } as const
    await clientParity(
      r(
        R.SeparatorHostContext,
        { value: toolbar },
        r(R.Separator.Root),
        r(R.Separator.Root, { orientation: "horizontal" }),
      ),
      Host,
      { host: toolbar, items: [{}, { orientation: "horizontal" }] },
    )
    expectRindWarning(/decorative separator \(role none\) cannot be named/)
    const listbox = { context: "listbox" } as const
    await clientParity(
      r(
        R.SeparatorHostContext,
        { value: listbox },
        r(R.Separator.Root, { orientation: "vertical", "aria-label": "x" }),
      ),
      Host,
      { host: listbox, items: [{ orientation: "vertical", "aria-label": "x" }] },
    )
  })

  it("Badge", async () => {
    await same(r(R.Badge.Root, null, "Beta"), Badge.Root, { text: "Beta" })
    await same(r(R.Badge.Root, { label: "3 unread" }, "3"), Badge.Root, {
      label: "3 unread",
      text: "3",
    })
    await same(r(R.Badge.Root, { id: "c" }, "3"), Badge.Root, { id: "c", text: "3" })
    await child(r(R.Badge.Root, { render: r("strong") }, "New"), Badge.Root, {
      tag: "strong",
      text: "New",
    })
  })

  it("Kbd", async () => {
    for (const platform of ["apple", "other"] as const) {
      for (const keys of ["mod+shift+p", "g i", ["ctrl", "enter"]] as const) {
        await same(r(R.Kbd.Root, { keys: keys as never, platform }), Kbd.Root, { keys, platform })
      }
    }
    await same(r(R.Kbd.Root, null, "Esc"), Kbd.Root, { text: "Esc" })
  })

  it("Toggle", async () => {
    await same(r(R.Toggle.Root, null, "Bold"), Toggle.Root, { text: "Bold" })
    await clientParity(
      r(
        R.Toggle.Root,
        { defaultPressed: true, disabled: true },
        "Bold",
        r(R.Toggle.Indicator, null, "✓"),
      ),
      Indicator,
      {},
    )
  })

  it("Button", async () => {
    for (const p of [
      {},
      { type: "submit" },
      { disabled: true },
      { disabled: true, focusableWhenDisabled: true },
      { pending: true },
    ]) {
      await same(r(R.Button, p as R.ButtonProps, "Save"), Button, { ...p, text: "Save" })
    }
    await same(r(R.Button, { render: r("a", { href: "/docs" }) }, "Docs"), Button, {
      href: "/docs",
      text: "Docs",
    })
    await child(r(R.Button, { render: r("div") }, "Save"), Button, { tag: "div", text: "Save" })
  })
})
