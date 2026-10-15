import type { Href, Router } from "@rind-ui/core"
import { type ReactNode, useMemo } from "react"
import { RindProvider } from "../provider"

export interface RouterProviderProps {
  /** Client navigation, e.g. react-router's `navigate` or Next.js `router.push`. */
  readonly navigate: Router["navigate"]
  /** The rendered href (basename): a plain function, never a hook. */
  readonly href?: ((href: Href) => string) | undefined
  readonly children?: ReactNode
}

/** Client routing for every link part below; the innermost provider wins. */
export function RouterProvider({ navigate, href, children }: RouterProviderProps) {
  const environment = useMemo(
    () => ({ router: href ? { navigate, href } : { navigate } }),
    [navigate, href],
  )
  return <RindProvider environment={environment}>{children}</RindProvider>
}
