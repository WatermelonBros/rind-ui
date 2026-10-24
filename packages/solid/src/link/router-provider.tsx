/** @jsxImportSource solid-js */
import type { Href, Router } from "@rind-ui/core"
import { createMemo, type JSX } from "solid-js"
import { RindProvider } from "../provider"

export interface RouterProviderProps {
  /** Client navigation, e.g. a router's `navigate`. */
  readonly navigate: Router["navigate"]
  /** The rendered href (basename): a plain function. */
  readonly href?: ((href: Href) => string) | undefined
  /** The tree whose link parts route through `navigate`. */
  readonly children?: JSX.Element
}

/** Client routing for every link part below; the innermost provider wins. */
export function RouterProvider(props: RouterProviderProps) {
  const environment = createMemo(() => ({
    router: props.href
      ? { navigate: props.navigate, href: props.href }
      : { navigate: props.navigate },
  }))
  return <RindProvider environment={environment()}>{props.children}</RindProvider>
}
