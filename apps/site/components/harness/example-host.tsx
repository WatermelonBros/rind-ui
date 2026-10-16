"use client"

import { RindProvider } from "@rind-ui/react"
import { type RefObject, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react"
import { harnessExample, type Skin } from "@/examples/harness"

const noSubscription = () => () => {}

/** Rendered after the example, so its effect runs after the example's: tests wait for this. */
function Hydrated({ root }: { root: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    if (root.current) root.current.dataset["hydrated"] = ""
  }, [root])
  return null
}

/** One example alone on the page: no site chrome; reduced motion unless it keeps motion. */
export function ExampleHost({
  slug,
  example,
  skin,
  motion,
}: {
  slug: string
  example: string
  skin: Skin
  motion: "keep" | "reduce"
}) {
  const Example = harnessExample(slug, example)
  const preset = skin === "theme-calm" ? "calm" : skin === "theme-crisp" ? "crisp" : undefined
  const site = skin === "bare" || skin === "crisp" || skin === "juicy"
  const theme = preset ?? (site ? `skin-${skin}` : undefined)
  const root = useRef<HTMLElement>(null)
  // The example renders on the client only, as in Storybook: hydrating it against the static
  // HTML sometimes gave its useId values other than the server's (the hydration timing
  // depends on when Next's scripts arrive), so a server id and a client reference disagreed.
  const mounted = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  // on <html> too, as real apps do: content portalled with no logical parent lands outside <main>
  useLayoutEffect(() => {
    if (theme) document.documentElement.dataset["rindTheme"] = theme
  }, [theme])
  return (
    <RindProvider environment={motion === "reduce" ? { reducedMotion: true } : {}}>
      <main
        ref={root}
        data-example-root=""
        data-skin={skin}
        data-motion={motion}
        {...(site ? { "data-skinned": "" } : {})}
        {...(theme ? { "data-rind-theme": theme } : {})}
      >
        {/* no Heading.Level: a bare Heading is an h2, as under a docs page's h1 */}
        {mounted && Example && <Example />}
        {mounted && <Hydrated root={root} />}
      </main>
    </RindProvider>
  )
}
