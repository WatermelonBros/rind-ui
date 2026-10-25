// The Toolbar contract model (React's matrix) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import { createListCollection, platforms, toolbarArgs, toolbarContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { type ReactNode, createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { RadioGroup } from "../radio-group/radio-group"
import { ToggleGroup } from "../toggle-group/toggle-group"
import { Toolbar } from "./toolbar"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type Body = "plain" | "first-disabled" | "field" | "hosted" | "group"
interface Cfg {
  readonly root?: {
    readonly orientation?: "horizontal" | "vertical"
    readonly loop?: boolean
    readonly focusableWhenDisabled?: boolean
    readonly disabled?: boolean
  }
  readonly controls: readonly { readonly label: string; readonly skip?: boolean }[]
  readonly body: Body
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
      body: "plain",
      react: () => plain.map((l) => rButton(l)),
      target: "Link",
    },
  },
  {
    name: "vertical",
    cfg: {
      root: { orientation: "vertical" },
      controls: plain.map((label) => ({ label })),
      body: "plain",
      react: () => plain.map((l) => rButton(l)),
      target: "Link",
    },
  },
  {
    name: "loop false",
    cfg: {
      root: { loop: false },
      controls: plain.map((label) => ({ label })),
      body: "plain",
      react: () => plain.map((l) => rButton(l)),
      target: "Link",
    },
  },
  {
    name: "first disabled, not focusable",
    cfg: {
      root: { focusableWhenDisabled: false },
      controls: [{ label: "Undo", skip: true }, { label: "Bold" }, { label: "Link" }],
      body: "first-disabled",
      react: () => [rButton("Undo", true), rButton("Bold"), rButton("Link")],
      target: "Link",
    },
  },
  {
    name: "text field in the middle",
    cfg: {
      controls: [{ label: "Undo" }, { label: "Size" }, { label: "Bold" }],
      body: "field",
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
      body: "hosted",
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
  loop: cfg.root?.loop ?? true,
  focusableWhenDisabled: false,
  orientation: cfg.root?.orientation ?? "horizontal",
  disabled: false,
})

/** The configuration the next fixture renders, and whether it adds the focus neighbours. */
let current: { cfg: Cfg; around: boolean } = {
  cfg: { controls: [], body: "plain", react: () => [], target: "" },
  around: false,
}

@Component({
  selector: "rind-f",
  imports: [RindProvider, Toolbar, ToggleGroup, RadioGroup],
  template: `<ng-container rindProvider [environment]="env" [dir]="dir">
    @if (around) {
      <button type="button">Before</button>
    }
    <div
      rindToolbarRoot
      aria-label="Formatting"
      [orientation]="root.orientation ?? 'horizontal'"
      [loop]="root.loop ?? true"
      [focusableWhenDisabled]="root.focusableWhenDisabled ?? true"
      [disabled]="root.disabled ?? false"
    >
      @switch (body) {
        @case ("plain") {
          <button rindToolbarButton id="Undo">Undo</button>
          <button rindToolbarButton id="Bold">Bold</button>
          <button rindToolbarButton id="Link">Link</button>
        }
        @case ("first-disabled") {
          <button rindToolbarButton id="Undo" disabled>Undo</button>
          <button rindToolbarButton id="Bold">Bold</button>
          <button rindToolbarButton id="Link">Link</button>
        }
        @case ("field") {
          <button rindToolbarButton id="Undo">Undo</button>
          <input rindToolbarItem id="Size" aria-label="Size" value="hi" />
          <button rindToolbarButton id="Bold">Bold</button>
        }
        @case ("hosted") {
          <button rindToolbarButton id="Undo">Undo</button>
          <div rindToggleGroupRoot id="style" aria-label="Style" selectionMode="multiple">
            <button rindToggleGroupItem value="b">Bold</button>
            <button rindToggleGroupItem value="i">Italic</button>
          </div>
          <div rindRadioGroupRoot id="align" aria-label="Align" defaultValue="l">
            <div rindRadioGroupItem value="l"><button rindRadioGroupItemControl aria-label="Left"></button></div>
            <div rindRadioGroupItem value="r"><button rindRadioGroupItemControl aria-label="Right"></button></div>
          </div>
        }
        @case ("group") {
          <div rindToolbarGroup aria-label="History">
            <button rindToolbarButton id="Undo">Undo</button>
            <button rindToolbarButton id="Redo">Redo</button>
          </div>
          <div rindToolbarSeparator></div>
          <a rindToolbarLink href="#help">Help</a>
        }
      }
    </div>
    @if (around) {
      <button type="button">After</button>
    }
  </ng-container>`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly root = current.cfg.root ?? {}
  readonly body = current.cfg.body
  readonly around = current.around
}

for (const { name, cfg } of configs) {
  describe(`angular toolbar model: ${name}`, () => {
    testMachine(toolbarContract, {
      test: it,
      setup: () => {
        toolbarArgs.current = { label: cfg.target }
        current = { cfg, around: true }
        return mount(Tree)
      },
      target: () => screen,
      anchor: [{ name: "Formatting" }] as never,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("Angular Toolbar matches React", () => {
  it("configurations, a group and a separator", async () => {
    for (const { cfg } of configs) {
      current = { cfg, around: false }
      await both(
        r(R.Toolbar.Root, { "aria-label": "Formatting", ...cfg.root } as never, ...cfg.react()),
        Tree,
      )
    }
    current = {
      cfg: { root: { disabled: true }, controls: [], body: "group", react: () => [], target: "" },
      around: false,
    }
    await both(
      r(
        R.Toolbar.Root,
        { "aria-label": "Formatting", disabled: true },
        r(R.Toolbar.Group, { "aria-label": "History" }, rButton("Undo"), rButton("Redo")),
        r(R.Toolbar.Separator),
        r(R.Toolbar.Link, { href: "#help" }, "Help"),
      ),
      Tree,
    )
  })
})
