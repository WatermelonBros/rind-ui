/** @jsxImportSource solid-js */
// The Toolbar contract model (React's matrix) against the Solid parts, a Separator and hosted
// Toggle and Radio Groups inside it, and markup parity.
import { createListCollection, platforms, toolbarArgs, toolbarContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { type ReactNode, createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import {
  RadioGroup,
  RindProvider,
  Separator,
  ToggleGroup,
  Toolbar,
  type ToolbarRootProps,
} from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface Cfg {
  readonly root?: Record<string, unknown>
  readonly controls: readonly { readonly label: string; readonly skip?: boolean }[]
  readonly body: () => JSX.Element
  readonly react: () => ReactNode[]
  readonly target: string
}
const button = (label: string, disabled = false) => (
  <Toolbar.Button id={label} disabled={disabled}>
    {label}
  </Toolbar.Button>
)
const field = (label: string) => (
  <Toolbar.Item
    id={label}
    render={(p) => <input {...p} aria-label={label} {...{ "attr:value": "hi" }} />}
  />
)
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
      body: () => <For each={plain}>{(l) => button(l)}</For>,
      react: () => plain.map((l) => rButton(l)),
      target: "Link",
    },
  },
  {
    name: "vertical",
    cfg: {
      root: { orientation: "vertical" },
      controls: plain.map((label) => ({ label })),
      body: () => <For each={plain}>{(l) => button(l)}</For>,
      react: () => plain.map((l) => rButton(l)),
      target: "Link",
    },
  },
  {
    name: "loop false",
    cfg: {
      root: { loop: false },
      controls: plain.map((label) => ({ label })),
      body: () => <For each={plain}>{(l) => button(l)}</For>,
      react: () => plain.map((l) => rButton(l)),
      target: "Link",
    },
  },
  {
    name: "first disabled, not focusable",
    cfg: {
      root: { focusableWhenDisabled: false },
      controls: [{ label: "Undo", skip: true }, { label: "Bold" }, { label: "Link" }],
      body: () => (
        <>
          {button("Undo", true)}
          {button("Bold")}
          {button("Link")}
        </>
      ),
      react: () => [rButton("Undo", true), rButton("Bold"), rButton("Link")],
      target: "Link",
    },
  },
  {
    name: "text field in the middle",
    cfg: {
      controls: [{ label: "Undo" }, { label: "Size" }, { label: "Bold" }],
      body: () => (
        <>
          {button("Undo")}
          {field("Size")}
          {button("Bold")}
        </>
      ),
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
      body: () => (
        <>
          {button("Undo")}
          <ToggleGroup.Root id="style" aria-label="Style" selectionMode="multiple">
            <ToggleGroup.Item value="b">Bold</ToggleGroup.Item>
            <ToggleGroup.Item value="i">Italic</ToggleGroup.Item>
          </ToggleGroup.Root>
          <RadioGroup.Root id="align" aria-label="Align" defaultValue="l">
            <For each={["l", "r"]}>
              {(v) => (
                <RadioGroup.Item value={v}>
                  <RadioGroup.ItemControl aria-label={v === "l" ? "Left" : "Right"} />
                </RadioGroup.Item>
              )}
            </For>
          </RadioGroup.Root>
        </>
      ),
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
  describe(`solid toolbar model: ${name}`, () => {
    testMachine(toolbarContract, {
      test: it,
      setup: () => {
        toolbarArgs.current = { label: cfg.target }
        return mount(() => (
          <RindProvider
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
            dir={currentRun()?.direction ?? "ltr"}
          >
            <button type="button">Before</button>
            <Toolbar.Root aria-label="Formatting" {...(cfg.root as ToolbarRootProps)}>
              {cfg.body()}
            </Toolbar.Root>
            <button type="button">After</button>
          </RindProvider>
        ))
      },
      target: () => screen,
      anchor: [{ name: "Formatting" }] as never,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("solid toolbar parts", () => {
  it("a Separator inside is perpendicular; outside a toolbar it is horizontal", () => {
    mount(() => (
      <>
        <Toolbar.Root aria-label="Formatting">
          {button("Undo")}
          <Separator.Root data-testid="inside" />
        </Toolbar.Root>
        <Toolbar.Root aria-label="Side" orientation="vertical">
          {button("Up")}
          <Separator.Root data-testid="inside-v" />
        </Toolbar.Root>
        <Separator.Root data-testid="outside" />
      </>
    ))
    expect(screen.getByTestId("inside").getAttribute("aria-orientation")).toBe("vertical")
    expect(screen.getByTestId("inside-v").getAttribute("data-orientation")).toBe("horizontal")
    expect(screen.getByTestId("outside").getAttribute("data-orientation")).toBe("horizontal")
  })
})

describe("Solid Toolbar matches React", () => {
  it("configurations, a group and a separator", async () => {
    for (const { cfg } of configs) {
      const react = r(
        R.Toolbar.Root,
        { "aria-label": "Formatting", ...cfg.root } as never,
        ...cfg.react(),
      )
      await clientParity(react, () => (
        <Toolbar.Root aria-label="Formatting" {...(cfg.root as ToolbarRootProps)}>
          {cfg.body()}
        </Toolbar.Root>
      ))
    }
    await clientParity(
      r(
        R.Toolbar.Root,
        { "aria-label": "Formatting", disabled: true },
        r(R.Toolbar.Group, { "aria-label": "History" }, rButton("Undo"), rButton("Redo")),
        r(R.Toolbar.Separator),
        r(R.Toolbar.Link, { href: "#help" }, "Help"),
      ),
      () => (
        <Toolbar.Root aria-label="Formatting" disabled>
          <Toolbar.Group aria-label="History">
            {button("Undo")}
            {button("Redo")}
          </Toolbar.Group>
          <Toolbar.Separator />
          <Toolbar.Link href="#help">Help</Toolbar.Link>
        </Toolbar.Root>
      ),
    )
  })
})
