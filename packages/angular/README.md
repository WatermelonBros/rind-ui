# @rind-ui/angular

Angular directives for rind-ui: behaviour, accessibility and state — you bring the styles. The
same machines, ARIA and test drivers as `@rind-ui/react`, with Angular's idioms: attribute
directives on your own elements, signal inputs, `[(value)]` two-way binding.

```sh
pnpm add @rind-ui/angular
```

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

Components are being ported one at a time; `package.json` `exports` lists the ones this
version ships. Part of [rind-ui](https://github.com/WatermelonBros/rind-ui).

MIT © rind-ui contributors
