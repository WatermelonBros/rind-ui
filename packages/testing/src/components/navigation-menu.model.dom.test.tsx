// Model-based tests (task 5.1): the Navigation Menu contract over every mapped transition in
// pointer, keyboard, touch and virtual, for both closed-content modes and with hover opening
// off, with the layer, presence and timed invariants, the per-contract ones and axe per state.
import {
  anchoredNavigationMenuContract,
  navigationMenuArgs,
  navigationMenuContract,
} from "@rind-ui/core"
import { NavigationMenu, type NavigationMenuRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { domEnv, testMachine, virtualClock } from "../index"

const clock = virtualClock()

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

interface Cfg {
  readonly root?: Partial<NavigationMenuRootProps>
  /** A nested level (a Sub with its own item) inside the Products panel. */
  readonly nested?: boolean
  readonly dir?: "ltr" | "rtl"
  /** The parent owns `value` (prop steps re-render it). */
  readonly controlled?: boolean
  /** Each item's Content in its own Positioner (the `anchored` contract). */
  readonly positioned?: boolean
}

function Example({ cfg, value }: { cfg: Cfg; value?: string | null }) {
  const dir = cfg.dir ?? "ltr"
  const place = (content: ReactElement) =>
    cfg.positioned ? <NavigationMenu.Positioner>{content}</NavigationMenu.Positioner> : content
  return (
    <RindProvider environment={{ scheduler: clock.scheduler }} dir={dir}>
      <div dir={dir}>
        <a href="/before">Before</a>
        <NavigationMenu.Root
          openDelay={200}
          closeDelay={100}
          {...cfg.root}
          {...(cfg.controlled ? { value: value ?? null } : {})}
        >
          <NavigationMenu.List>
            <NavigationMenu.Item value="products">
              <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
              {place(
                <NavigationMenu.Content>
                  <NavigationMenu.Link href="#analytics">Analytics</NavigationMenu.Link>
                  <NavigationMenu.Link href="#engage">Engage</NavigationMenu.Link>
                  {cfg.nested && (
                    <NavigationMenu.Sub>
                      <NavigationMenu.List>
                        <NavigationMenu.Item value="more">
                          <NavigationMenu.Trigger>More</NavigationMenu.Trigger>
                          <NavigationMenu.Content>
                            <NavigationMenu.Link href="#labs">Labs</NavigationMenu.Link>
                          </NavigationMenu.Content>
                        </NavigationMenu.Item>
                      </NavigationMenu.List>
                    </NavigationMenu.Sub>
                  )}
                </NavigationMenu.Content>,
              )}
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#pricing">Pricing</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
        <a href="/after">After</a>
      </div>
    </RindProvider>
  )
}

const configs: { name: string; cfg: Cfg }[] = [
  { name: "hidden content", cfg: {} },
  { name: "unmounted content", cfg: { root: { closedContent: "unmount" } } },
  { name: "click only", cfg: { root: { openOnHover: false } } },
  { name: "nested levels", cfg: { nested: true } },
  { name: "nested levels, unmounted", cfg: { nested: true, root: { closedContent: "unmount" } } },
  { name: "right to left", cfg: { dir: "rtl" } },
  { name: "positioned", cfg: { positioned: true } },
]

for (const { name, cfg } of configs) {
  const root = cfg.root ?? {}
  describe(`navigation menu model: ${name}`, () => {
    testMachine(cfg.positioned ? anchoredNavigationMenuContract : navigationMenuContract, {
      test: it,
      setup: () => {
        navigationMenuArgs.current = { item: "Products", link: "Analytics" }
        return render(<Example cfg={cfg} />)
      },
      ...(cfg.controlled
        ? {
            rerender: (next: unknown, rendered: ReturnType<typeof render>) =>
              rendered.rerender(
                <Example cfg={cfg} value={(next as { value?: string | null }).value ?? null} />,
              ),
          }
        : {}),
      target: () => screen,
      anchor: [{ name: "Main" }] as never,
      // `root` is internal (set by NavigationMenu.Root); the oracle only needs a value.
      props: {
        root: "oracle",
        value: cfg.controlled ? null : undefined,
        disabled: undefined,
        openDelay: 200,
        closeDelay: 100,
        openOnHover: root.openOnHover,
        isItemDisabled: () => false,
        patientClick: 500,
        positioned: cfg.positioned ? "item" : undefined,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      clock,
      a11y,
    })
  })
}

/** Every failure of the contract run on a broken variant. */
async function failures(ui: () => ReactElement) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(navigationMenuContract, {
    test: (n, fn) => tests.push({ name: n, fn }),
    setup: () => {
      navigationMenuArgs.current = { item: "Products", link: "Analytics" }
      return render(ui())
    },
    target: () => domEnv({ timeout: 200 }),
    anchor: [{ name: "Main" }] as never,
    props: {
      root: "oracle",
      disabled: undefined,
      openOnHover: undefined,
      isItemDisabled: () => false,
      patientClick: 500,
    } as never,
    modalities: ["keyboard"],
    clock,
  })
  const out: string[] = []
  for (const t of tests) {
    await t.fn().catch((e: Error) => out.push(e.message))
    document.body.innerHTML = ""
  }
  return out.join("\n")
}

describe("a consumer wrapper adding menu roles fails the invariant", () => {
  it("role=menubar on the list", { timeout: 60_000 }, async () => {
    const out = await failures(() => (
      <RindProvider environment={{ scheduler: clock.scheduler }}>
        <NavigationMenu.Root>
          <NavigationMenu.List role="menubar">
            <NavigationMenu.Item value="products">
              <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#analytics">Analytics</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </RindProvider>
    ))
    expect(out).toMatch(/navigation-menu-no-menu-semantics: the list part has role="menubar"/)
  })
})
