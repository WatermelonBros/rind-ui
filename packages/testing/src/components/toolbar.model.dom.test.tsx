// Model-based tests (task 5.3): the Toolbar contract over every transition in pointer,
// touch, keyboard and virtual, LTR and RTL, for the argument classes of the spec's
// Model-Based Coverage that exist today (horizontal, vertical, loop false, first control
// disabled, all disabled, a text field first / middle / last, hosted Radio Group and
// Toggle Group; a Menu trigger waits for add-menu), with the one-tab-stop invariant.
import { createListCollection, platforms, toolbarArgs, toolbarContract } from "@rind-ui/core"
import { RadioGroup, RindProvider, ToggleGroup, Toolbar } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { ReactElement, ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, domEnv, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const anchor = [{ name: "Formatting" }] as never

type RootProps = Parameters<typeof Toolbar.Root>[0]
interface Cfg {
  readonly root?: Partial<RootProps>
  /** The controls, in order: ids are their labels (the oracle's keys). */
  readonly controls: readonly { readonly label: string; readonly skip?: boolean }[]
  readonly body: ReactNode
  readonly target: string
}

const button = (label: string, disabled = false) => (
  <Toolbar.Button key={label} id={label} disabled={disabled}>
    {label}
  </Toolbar.Button>
)
const field = (label: string) => (
  <Toolbar.Item key={label} id={label} render={<input aria-label={label} defaultValue="hi" />} />
)

function Bar({ cfg }: { cfg: Cfg }) {
  return (
    <RindProvider
      environment={{ platform: currentRun()?.platform ?? platforms.linux }}
      dir={currentRun()?.direction ?? "ltr"}
    >
      <button type="button">Before</button>
      <Toolbar.Root aria-label="Formatting" {...cfg.root}>
        {cfg.body}
      </Toolbar.Root>
      <button type="button">After</button>
    </RindProvider>
  )
}

const plain = ["Undo", "Bold", "Link"]
const configs: { name: string; cfg: Cfg }[] = [
  {
    name: "horizontal",
    cfg: {
      controls: plain.map((label) => ({ label })),
      body: plain.map((l) => button(l)),
      target: "Link",
    },
  },
  {
    name: "vertical",
    cfg: {
      root: { orientation: "vertical" },
      controls: plain.map((label) => ({ label })),
      body: plain.map((l) => button(l)),
      target: "Link",
    },
  },
  {
    name: "loop false",
    cfg: {
      root: { loop: false },
      controls: plain.map((label) => ({ label })),
      body: plain.map((l) => button(l)),
      target: "Link",
    },
  },
  {
    name: "first disabled, not focusable",
    cfg: {
      root: { focusableWhenDisabled: false },
      controls: [{ label: "Undo", skip: true }, { label: "Bold" }, { label: "Link" }],
      body: [button("Undo", true), button("Bold"), button("Link")],
      target: "Link",
    },
  },
  {
    name: "text field in the middle",
    cfg: {
      controls: [{ label: "Undo" }, { label: "Size" }, { label: "Bold" }],
      body: [button("Undo"), field("Size"), button("Bold")],
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
      body: [
        button("Undo"),
        <ToggleGroup.Root key="tg" id="style" aria-label="Style" selectionMode="multiple">
          <ToggleGroup.Item value="b">Bold</ToggleGroup.Item>
          <ToggleGroup.Item value="i">Italic</ToggleGroup.Item>
        </ToggleGroup.Root>,
        <RadioGroup.Root key="rg" id="align" aria-label="Align" defaultValue="l">
          {["l", "r"].map((v) => (
            <RadioGroup.Item key={v} value={v}>
              <RadioGroup.ItemControl aria-label={v === "l" ? "Left" : "Right"} />
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>,
      ],
      target: "Undo",
    },
  },
]

// Every prop the machine reads, as the component receives it.
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

for (const { name, cfg } of configs) {
  describe(`toolbar model: ${name}`, () => {
    testMachine(toolbarContract, {
      test: it,
      setup: () => {
        toolbarArgs.current = { label: cfg.target }
        return render(<Bar cfg={cfg} />)
      },
      target: () => screen,
      anchor,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

/** Every failure of the contract run on a broken variant. */
async function failures(ui: () => ReactElement) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  const cfg = configs[0]?.cfg as Cfg
  testMachine(toolbarContract, {
    test: (n, fn) => tests.push({ name: n, fn }),
    setup: () => {
      toolbarArgs.current = { label: "Link" }
      return render(ui())
    },
    target: () => domEnv({ timeout: 200 }),
    anchor,
    props: propsOf(cfg) as never,
    modalities: ["keyboard", "pointer"],
  })
  const out: string[] = []
  for (const t of tests) {
    await t.fn().catch((e: Error) => out.push(e.message))
    document.body.innerHTML = ""
  }
  return out.join("\n")
}

describe("broken Toolbars fail readably (spec scenario: a wrapper adds a second tab stop)", () => {
  it("every control forced to tabIndex 0", { timeout: 60_000 }, async () => {
    const out = await failures(() => (
      <>
        <button type="button">Before</button>
        <Toolbar.Root aria-label="Formatting">
          {plain.map((l) => (
            <Toolbar.Button key={l} id={l} tabIndex={0}>
              {l}
            </Toolbar.Button>
          ))}
        </Toolbar.Root>
        <button type="button">After</button>
      </>
    ))
    expect(out).toMatch(/toolbar-one-tab-stop: 3 controls have tabindex="0": Undo, Bold, Link/)
  })
})
