// Consumers type `routerOptions` by augmenting RouterConfig (openspec link, "Router types").
import type { LinkInput } from "../dom/link"
import type { RouterOptions } from "./router"

declare module "./router" {
  interface RouterConfig {
    routerOptions: { replace?: boolean }
  }
}

export const ok: LinkInput = { tag: "a", href: "/a", routerOptions: { replace: true } }
// @ts-expect-error `foo` is not a routerOptions key
export const bad: LinkInput = { tag: "a", href: "/a", routerOptions: { foo: 1 } }
export const options: RouterOptions = { replace: false }
