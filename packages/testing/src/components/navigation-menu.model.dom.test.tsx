// Model-based tests (task 5.1): the Navigation Menu contract over every mapped transition in
// pointer, keyboard, touch and virtual, for both closed-content modes and with hover opening
// off, with the layer, presence and timed invariants, the per-contract ones and axe per state.
import { navigationMenuArgs, navigationMenuContract } from "@rind-ui/core"
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

function Example(props: Partial<NavigationMenuRootProps>) {
  return (
    <RindProvider environment={{ scheduler: clock.scheduler }}>
      <a href="/before">Before</a>
      <NavigationMenu.Root openDelay={200} closeDelay={100} {...props}>
        <NavigationMenu.List>
          <NavigationMenu.Item value="products">
            <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#analytics">Analytics</NavigationMenu.Link>
              <NavigationMenu.Link href="#engage">Engage</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Link href="#pricing">Pricing</NavigationMenu.Link>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
      <a href="/after">After</a>
    </RindProvider>
  )
}

const configs: { name: string; root: Partial<NavigationMenuRootProps> }[] = [
  { name: "hidden content", root: {} },
  { name: "unmounted content", root: { closedContent: "unmount" } },
  { name: "click only", root: { openOnHover: false } },
]

for (const { name, root } of configs) {
  describe(`navigation menu model: ${name}`, () => {
    testMachine(navigationMenuContract, {
      test: it,
      setup: () => {
        navigationMenuArgs.current = { item: "Products", link: "Analytics" }
        return render(<Example {...root} />)
      },
      target: () => screen,
      anchor: [{ name: "Main" }] as never,
      // `root` is internal (set by NavigationMenu.Root); the oracle only needs a value.
      props: {
        root: "oracle",
        value: undefined,
        disabled: undefined,
        openDelay: 200,
        closeDelay: 100,
        openOnHover: root.openOnHover,
        isItemDisabled: () => false,
        patientClick: 500,
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
