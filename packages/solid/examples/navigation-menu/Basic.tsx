/** @jsxImportSource solid-js */
import { NavigationMenu } from "@rind-ui/solid"

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
