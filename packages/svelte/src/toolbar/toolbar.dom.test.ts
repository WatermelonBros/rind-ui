// The Toolbar contract model (React's matrix) against the Svelte parts, and DOM parity.
import { createListCollection, toolbarArgs, toolbarContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { type ReactNode, createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Bar from "../../fixtures/toolbar/bar.svelte"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface Cfg {
  readonly root?: Record<string, unknown>
  readonly controls: readonly { readonly label: string; readonly skip?: boolean }[]
  readonly react: () => ReactNode[]
  readonly target: string
}
const rButton = (label: string, disabled = false) =>
  r(R.Toolbar.Button, { key: label, id: label, disabled }, label)
const rField = (label: string) =>
  r(R.Toolbar.Item, {
    key: label,
    id: label,
    render: r("input", { "aria-label": label, defaultValue: "hi" }),
  })
const plain = ["Undo", "Bold", "Link"]
const configs: { name: string; cfg: Cfg }[] = [
  {
    name: "horizontal",
    cfg: {
      controls: plain.map((label) => ({ label })),
      react: () => plain.map((l) => rButton(l)),
      target: "Link",
    },
  },
  {
    name: "vertical",
    cfg: {
      root: { orientation: "vertical" },
      controls: plain.map((label) => ({ label })),
      react: () => plain.map((l) => rButton(l)),
      target: "Link",
    },
  },
  {
    name: "loop false",
    cfg: {
      root: { loop: false },
      controls: plain.map((label) => ({ label })),
      react: () => plain.map((l) => rButton(l)),
      target: "Link",
    },
  },
  {
    name: "first disabled, not focusable",
    cfg: {
      root: { focusableWhenDisabled: false },
      controls: [{ label: "Undo", skip: true }, { label: "Bold" }, { label: "Link" }],
      react: () => [rButton("Undo", true), rButton("Bold"), rButton("Link")],
      target: "Link",
    },
  },
  {
    name: "text field in the middle",
    cfg: {
      controls: [{ label: "Undo" }, { label: "Size" }, { label: "Bold" }],
      react: () => [rButton("Undo"), rField("Size"), rButton("Bold")],
      target: "Bold",
    },
  },
  {
    name: "hosted toggle group and radio group",
    cfg: {
      controls: [
        { label: "Undo" },
        { label: "toggle-group-style-item-b" },
        { label: "toggle-group-style-item-i" },
        { label: "radio-group-align-item-control-l" },
        { label: "radio-group-align-item-control-r" },
      ],
      react: () => [
        rButton("Undo"),
        r(
          R.ToggleGroup.Root,
          { key: "tg", id: "style", "aria-label": "Style", selectionMode: "multiple" },
          r(R.ToggleGroup.Item, { value: "b" }, "Bold"),
          r(R.ToggleGroup.Item, { value: "i" }, "Italic"),
        ),
        r(
          R.RadioGroup.Root,
          { key: "rg", id: "align", "aria-label": "Align", defaultValue: "l" },
          ["l", "r"].map((v) =>
            r(
              R.RadioGroup.Item,
              { key: v, value: v },
              r(R.RadioGroup.ItemControl, { "aria-label": v === "l" ? "Left" : "Right" }),
            ),
          ),
        ),
      ],
      target: "Undo",
    },
  },
]
const propsOf = (cfg: Cfg) => ({
  collection: createListCollection({
    items: cfg.controls,
    getKey: (c) => c.label,
    getText: (c) => c.label,
    isDisabled: (c) => c.skip === true,
  }),
  strategy: "roving",
  ids: { list: "root", item: (k: string) => k },
  loop: cfg.root?.["loop"] ?? true,
  focusableWhenDisabled: false,
  orientation: cfg.root?.["orientation"] ?? "horizontal",
  disabled: false,
})

for (const { name, cfg } of configs) {
  describe(`svelte toolbar model: ${name}`, () => {
    testMachine(toolbarContract, {
      test: it,
      setup: () => {
        toolbarArgs.current = { label: cfg.target }
        return mount(Bar, { name, root: cfg.root ?? {} } as never)
      },
      target: () => screen,
      anchor: [{ name: "Formatting" }] as never,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("Svelte Toolbar matches React", () => {
  it("configurations, a group and a separator", async () => {
    for (const { name, cfg } of configs) {
      const react = r(
        R.Toolbar.Root,
        { "aria-label": "Formatting", ...cfg.root } as never,
        ...cfg.react(),
      )
      await clientParity(react, Bar, { name, root: cfg.root ?? {}, provider: false } as never)
    }
    const react = r(
      R.Toolbar.Root,
      { "aria-label": "Formatting", disabled: true },
      r(R.Toolbar.Group, { "aria-label": "History" }, rButton("Undo"), rButton("Redo")),
      r(R.Toolbar.Separator),
      r(R.Toolbar.Link, { href: "#help" }, "Help"),
    )
    await clientParity(react, Bar, { name: "group", provider: false } as never)
  })
})
