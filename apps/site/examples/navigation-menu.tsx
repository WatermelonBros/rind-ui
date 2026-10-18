"use client"

import { NavigationMenu, Portal, RindProvider } from "@rind-ui/react"
import type { States, Variants } from "./types"

export const states: States = { "navigation-menu": { closed: "Basic", open: "Open" } }

export function Basic() {
  return (
    <NavigationMenu.Root aria-label="Docs">
      <NavigationMenu.List>
        <NavigationMenu.Item value="components">
          <NavigationMenu.Trigger>Components</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="/docs/button/">Button</NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/dialog/">Dialog</NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/tabs/">Tabs</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="guides">
          <NavigationMenu.Trigger>Guides</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="/docs/positioning/">Positioning</NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/keyboard-and-rtl/">
              Keyboard and RTL
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="/docs/">All docs</NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}

export function Open() {
  return (
    <NavigationMenu.Root aria-label="Docs (open)" defaultValue="components">
      <NavigationMenu.List>
        <NavigationMenu.Item value="components">
          <NavigationMenu.Trigger>Components</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="/docs/button/">Button</NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/dialog/" current="page">
              Dialog
            </NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/tabs/">Tabs</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="/docs/">All docs</NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}

export function MegaMenu() {
  return (
    <NavigationMenu.Root aria-label="Product">
      <NavigationMenu.List>
        <NavigationMenu.Item value="components">
          <NavigationMenu.Trigger>Components</NavigationMenu.Trigger>
          <NavigationMenu.Content data-layout="grid">
            <NavigationMenu.Link href="/docs/dialog/">
              <strong>Dialog</strong>
              <span>A modal window with focus kept inside.</span>
            </NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/popover/">
              <strong>Popover</strong>
              <span>Rich content next to its trigger.</span>
            </NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/tabs/">
              <strong>Tabs</strong>
              <span>Panels switched by a row of tabs.</span>
            </NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/menubar/">
              <strong>Menubar</strong>
              <span>An application's File, Edit, View.</span>
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="guides">
          <NavigationMenu.Trigger>Guides</NavigationMenu.Trigger>
          <NavigationMenu.Content data-layout="grid">
            <NavigationMenu.Link href="/docs/positioning/">
              <strong>Positioning</strong>
              <span>Placing popups next to their anchor.</span>
            </NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/testing-accessibility/">
              <strong>Testing</strong>
              <span>Drivers, contracts and model tests.</span>
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="/docs/">All docs</NavigationMenu.Link>
        </NavigationMenu.Item>
        <NavigationMenu.Indicator />
      </NavigationMenu.List>
      <NavigationMenu.Positioner positioning={{ sideOffset: 12 }}>
        <NavigationMenu.Viewport />
      </NavigationMenu.Positioner>
    </NavigationMenu.Root>
  )
}

export function SplitItem() {
  return (
    <NavigationMenu.Root aria-label="Sections">
      <NavigationMenu.List>
        <NavigationMenu.Item value="components" data-split="">
          <NavigationMenu.Link href="/docs/">Components</NavigationMenu.Link>
          <NavigationMenu.Trigger aria-label="Show Components submenu" />
          <NavigationMenu.Content>
            <NavigationMenu.Link href="/docs/button/">Button</NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/link/">Link</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="/docs/get-started/">Get started</NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}

export function Nested() {
  return (
    <NavigationMenu.Root aria-label="Catalogue">
      <NavigationMenu.List>
        <NavigationMenu.Item value="components">
          <NavigationMenu.Trigger>Components</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="/docs/button/">Button</NavigationMenu.Link>
            <NavigationMenu.Sub>
              <NavigationMenu.List>
                <NavigationMenu.Item value="overlays">
                  <NavigationMenu.Trigger>Overlays</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="/docs/dialog/">Dialog</NavigationMenu.Link>
                    <NavigationMenu.Link href="/docs/drawer/">Drawer</NavigationMenu.Link>
                    <NavigationMenu.Link href="/docs/popover/">Popover</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>
            </NavigationMenu.Sub>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}

export function Positioned() {
  return (
    <div data-clip="">
      <NavigationMenu.Root aria-label="Header">
        <NavigationMenu.List>
          <NavigationMenu.Item value="components">
            <NavigationMenu.Trigger>Components</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="/docs/select/">Select</NavigationMenu.Link>
              <NavigationMenu.Link href="/docs/combobox/">Combobox</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item value="guides">
            <NavigationMenu.Trigger>Guides</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="/docs/overlays/">Overlays</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <Portal>
          <NavigationMenu.Positioner positioning={{ sideOffset: 12 }}>
            <NavigationMenu.Viewport />
          </NavigationMenu.Positioner>
        </Portal>
      </NavigationMenu.Root>
    </div>
  )
}

export function Vertical() {
  return (
    <NavigationMenu.Root aria-label="Sidebar" orientation="vertical" openOnHover={false}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="forms">
          <NavigationMenu.Trigger>Forms</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="/docs/field/">Field</NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/form/">Form</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="overlays">
          <NavigationMenu.Trigger>Overlays</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="/docs/dialog/">Dialog</NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/drawer/">Drawer</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="/docs/">All docs</NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}

export function ClickOnly() {
  return (
    <NavigationMenu.Root aria-label="Click to open" openOnHover={false}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="components">
          <NavigationMenu.Trigger>Components</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="/docs/slider/">Slider</NavigationMenu.Link>
            <NavigationMenu.Link href="/docs/switch/">Switch</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="guides">
          <NavigationMenu.Trigger>Guides</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="/docs/collections/">Collections</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  )
}

export function RightToLeft() {
  return (
    <RindProvider dir="rtl">
      <div dir="rtl" lang="ar">
        <NavigationMenu.Root aria-label="المستندات">
          <NavigationMenu.List>
            <NavigationMenu.Item value="components">
              <NavigationMenu.Trigger>المكوّنات</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="/docs/button/">زر</NavigationMenu.Link>
                <NavigationMenu.Link href="/docs/dialog/">حوار</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item value="guides">
              <NavigationMenu.Trigger>أدلة</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="/docs/keyboard-and-rtl/">
                  لوحة المفاتيح
                </NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </div>
    </RindProvider>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description:
      "Two panels and a link. Rest the pointer on a trigger, or press it; Escape closes and returns focus.",
  },
  MegaMenu: {
    title: "Mega menu",
    description:
      "A shared `Viewport` in a `Positioner` animates its size between panels; the `Indicator` follows the open trigger.",
  },
  SplitItem: {
    title: "Split item",
    description: "A `Link` that navigates and a `Trigger` that opens, in one `Item`.",
  },
  Nested: {
    title: "Nested level",
    description: "A `Sub` inside a panel: its own items and value.",
  },
  Positioned: {
    title: "Portalled",
    description:
      "The viewport in a `Portal`: it escapes a clipping header, and Tab still goes from the trigger into the panel.",
  },
  Vertical: {
    title: "Vertical",
    description:
      '`orientation="vertical"`, click only: a list of disclosures, as in a sidebar or a mobile drawer.',
  },
  ClickOnly: { title: "Click only", description: "`openOnHover={false}`: press and keys only." },
  RightToLeft: { title: "Right to left", description: "Arrow keys follow the reading direction." },
  Open: { title: "Open", hidden: true },
}
