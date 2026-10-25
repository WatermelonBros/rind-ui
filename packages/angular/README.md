# @rind-ui/angular

Angular directives for rind-ui: behaviour, accessibility and state — you bring the styles. The
same machines, ARIA and test drivers as `@rind-ui/react`, with Angular's idioms: attribute
directives on your own elements, signal inputs, `[(value)]` two-way binding.

```sh
pnpm add @rind-ui/angular
```

Needs `@angular/core` and `@angular/common` 21 or later. The package is published as Angular's
partial compilation; your application's build links it.

```ts
import { Component, signal } from "@angular/core"
import { Toggle } from "@rind-ui/angular" // or "@rind-ui/angular/toggle"

@Component({
  selector: "app-bold",
  imports: [Toggle],
  template: `<button rindToggleRoot [(pressed)]="bold">Bold</button>`,
})
export class Bold {
  readonly bold = signal(false)
}
```

Each component is an array of standalone directives for your component's `imports`, from the
root or from its own entry (`@rind-ui/angular/dialog`): your bundle carries only the components
you import. A part is an attribute on the element you write (`<button rindDialogTrigger>`), so
no wrapper element is added; a layer's content goes in a template
(`<ng-template rindDialogPortal>`), rendered after the first render. Server rendering and
hydration (`@angular/platform-server`, `provideClientHydration`) render the same markup as
React's.

Wrap the app in `<ng-container rindProvider>` to set the locale, the direction and the
environment (a test's clock); without it the defaults apply. `@rind-ui/testing` drives the
components in your tests through the same drivers as every framework.

Part of [rind-ui](https://github.com/WatermelonBros/rind-ui): see the main README and
`docs/components/` for the components and their APIs.

MIT © rind-ui contributors
