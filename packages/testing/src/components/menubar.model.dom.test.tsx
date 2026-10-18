// Model-based tests (task 5.3): the Menubar contract over every transition in pointer,
// touch, keyboard and virtual, LTR and RTL, for the spec's argument classes (horizontal,
// vertical, loop false, a disabled item, a disabled menubar, modal true / false), with the
// one-tab-stop and one-open-menu invariants and axe in every state.
import { createListCollection, menubarArgs, menubarContract, platforms } from "@rind-ui/core"
import { Menu, Menubar, type MenubarRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, domEnv, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const anchor = [{ name: "Application" }] as never

interface Cfg {
  readonly root?: Partial<MenubarRootProps>
  readonly disabled?: readonly string[]
}

const MENUS = { File: ["New", "Open"], Edit: ["Undo", "Redo"], View: ["Zoom in", "Zoom out"] }

function Bar({ cfg }: { cfg: Cfg }) {
  return (
    <RindProvider
      environment={{ platform: currentRun()?.platform ?? platforms.linux }}
      dir={currentRun()?.direction ?? "ltr"}
    >
      <button type="button">Before</button>
      <Menubar.Root aria-label="Application" {...cfg.root}>
        {Object.entries(MENUS).map(([label, items]) => (
          <Menubar.Menu key={label} value={label} disabled={cfg.disabled?.includes(label) ?? false}>
            <Menubar.Trigger>{label}</Menubar.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Content>
                  {items.map((i) => (
                    <Menu.Item key={i} value={i}>
                      {i}
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Portal>
          </Menubar.Menu>
        ))}
      </Menubar.Root>
      <button type="button">After</button>
    </RindProvider>
  )
}

const configs: { name: string; cfg: Cfg }[] = [
  { name: "horizontal", cfg: {} },
  { name: "vertical", cfg: { root: { orientation: "vertical" } } },
  { name: "loop false", cfg: { root: { loop: false } } },
  { name: "a disabled item", cfg: { disabled: ["Edit"] } },
  { name: "disabled menubar", cfg: { root: { disabled: true } } },
  { name: "non-modal", cfg: { root: { modal: false } } },
]

// Every prop the machine reads, as the component receives it.
const propsOf = (cfg: Cfg) => ({
  collection: createListCollection({
    items: Object.keys(MENUS),
    getKey: (l) => l,
    getText: (l) => l,
    isDisabled: (l) => cfg.disabled?.includes(l) === true,
  }),
  strategy: "roving",
  ids: { list: "root", item: (k: string) => k },
  loop: cfg.root?.loop ?? true,
  focusableWhenDisabled: cfg.root?.focusableWhenDisabled ?? true,
  orientation: cfg.root?.orientation ?? "horizontal",
  modal: cfg.root?.modal ?? true,
  disabled: cfg.root?.disabled ?? false,
  menus: { open: () => {}, close: () => {} },
})

for (const { name, cfg } of configs) {
  describe(`menubar model: ${name}`, () => {
    testMachine(menubarContract, {
      test: it,
      setup: () => {
        menubarArgs.current = { label: "File", other: "View" }
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
  testMachine(menubarContract, {
    test: (n, fn) => tests.push({ name: n, fn }),
    setup: () => {
      menubarArgs.current = { label: "File", other: "View" }
      return render(ui())
    },
    target: () => domEnv({ timeout: 200 }),
    anchor,
    props: propsOf({}) as never,
    modalities: ["keyboard"],
  })
  const out: string[] = []
  for (const t of tests) {
    await t.fn().catch((e: Error) => out.push(e.message))
    document.body.innerHTML = ""
  }
  return out.join("\n")
}

describe("broken Menubars fail readably (spec scenario: wrapper breaks the item role)", () => {
  it("items rendered as plain buttons", { timeout: 60_000 }, async () => {
    const out = await failures(() => (
      <>
        <button type="button">Before</button>
        <div
          role="menubar"
          aria-label="Application"
          data-scope="menubar"
          data-part="root"
          data-instance="broken"
        >
          {Object.keys(MENUS).map((l) => (
            <button key={l} type="button">
              {l}
            </button>
          ))}
        </div>
        <button type="button">After</button>
      </>
    ))
    expect(out).toMatch(/menubar-one-tab-stop: the menubar has no menu items/)
  })
})
