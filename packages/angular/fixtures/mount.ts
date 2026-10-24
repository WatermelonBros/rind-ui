// Mounts an Angular component for driver tests, destroyed after each test (the counterpart of
// Testing Library's render + auto-cleanup). Zoneless, as Angular applications are by default.
import {
  type ApplicationRef,
  type ComponentRef,
  createComponent,
  type EnvironmentProviders,
  type Provider,
  provideZonelessChangeDetection,
  type Type,
} from "@angular/core"
import { createApplication } from "@angular/platform-browser"
import { afterEach } from "vitest"

const mounted = new Set<{ app: ApplicationRef; host: HTMLElement }>()
afterEach(() => {
  for (const m of mounted) {
    m.app.destroy()
    m.host.remove()
  }
  mounted.clear()
})

export interface Mounted<C> {
  readonly host: HTMLElement
  readonly ref: ComponentRef<C>
  /** Sets the component's inputs and waits until Angular has rendered them. */
  rerender(next: Readonly<Record<string, unknown>>): Promise<void>
}

/** Renders `component` with `inputs` (set through `setInput`) once Angular is stable. */
export async function mount<C>(
  component: Type<C>,
  inputs: Readonly<Record<string, unknown>> = {},
  providers: (Provider | EnvironmentProviders)[] = [],
): Promise<Mounted<C>> {
  const host = document.body.appendChild(document.createElement("div"))
  const app = await createApplication({
    providers: [provideZonelessChangeDetection(), ...providers],
  })
  mounted.add({ app, host })
  const ref = createComponent(component, {
    environmentInjector: app.injector,
    hostElement: host,
  })
  for (const [key, value] of Object.entries(inputs)) ref.setInput(key, value)
  app.attachView(ref.hostView)
  await app.whenStable()
  return {
    host,
    ref,
    async rerender(next) {
      for (const [key, value] of Object.entries(next)) ref.setInput(key, value)
      await app.whenStable()
    },
  }
}
