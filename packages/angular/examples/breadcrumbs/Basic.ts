import { Component } from "@angular/core"
import { Breadcrumbs } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Breadcrumbs],
  template: `
    <nav rindBreadcrumbsRoot>
      <ol rindBreadcrumbsList>
        @for (c of crumbs; track c.label) {
          <li rindBreadcrumbsItem [value]="c.label" #i="rindBreadcrumbsItem">
            @if (i.state().current && !c.href) {
              <span rindBreadcrumbsCurrent>{{ c.label }}</span>
            } @else {
              <a rindBreadcrumbsLink [href]="c.href">{{ c.label }}</a>
            }
            <span rindBreadcrumbsSeparator>/</span>
          </li>
        }
      </ol>
    </nav>
  `,
})
export class Basic {
  readonly crumbs: readonly { label: string; href?: string }[] = [
    { label: "Home", href: "/" },
    { label: "Docs", href: "/docs/" },
    { label: "Breadcrumbs" },
  ]
}
