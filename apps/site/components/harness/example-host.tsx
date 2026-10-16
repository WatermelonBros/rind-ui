"use client"

import { RindProvider } from "@rind-ui/react"
import { useEffect, useLayoutEffect, useState } from "react"
import { harnessExample, type Skin } from "@/examples/harness"

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
  // on <html> too, as real apps do: content portalled with no logical parent lands outside <main>
  useLayoutEffect(() => {
    if (theme) document.documentElement.dataset["rindTheme"] = theme
  }, [theme])
  // effects run once the whole tree has hydrated: tests wait for this before acting
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return (
    <RindProvider environment={motion === "reduce" ? { reducedMotion: true } : {}}>
      <main
        data-example-root=""
        data-skin={skin}
        data-motion={motion}
        {...(hydrated ? { "data-hydrated": "" } : {})}
        {...(site ? { "data-skinned": "" } : {})}
        {...(theme ? { "data-rind-theme": theme } : {})}
      >
        {/* no Heading.Level: a bare Heading is an h2, as under a docs page's h1 */}
        {Example && <Example />}
      </main>
    </RindProvider>
  )
}
