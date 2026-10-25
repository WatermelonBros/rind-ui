import { Component } from "@angular/core"
import { NavigationMenu } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [NavigationMenu],
  template: `
    <nav rindNavigationMenuRoot aria-label="Docs">
      <ul rindNavigationMenuList>
        <li rindNavigationMenuItem value="components">
          <button rindNavigationMenuTrigger>Components</button>
          <div rindNavigationMenuContent>
            <a rindNavigationMenuLink href="/docs/button/">Button</a>
            <a rindNavigationMenuLink href="/docs/dialog/">Dialog</a>
            <a rindNavigationMenuLink href="/docs/tabs/">Tabs</a>
          </div>
        </li>
        <li rindNavigationMenuItem value="guides">
          <button rindNavigationMenuTrigger>Guides</button>
          <div rindNavigationMenuContent>
            <a rindNavigationMenuLink href="/docs/positioning/">Positioning</a>
            <a rindNavigationMenuLink href="/docs/keyboard-and-rtl/">Keyboard and RTL</a>
          </div>
        </li>
        <li rindNavigationMenuItem>
          <a rindNavigationMenuLink href="/docs/">All docs</a>
        </li>
      </ul>
    </nav>
  `,
})
export class Basic {}
