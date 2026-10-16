"use client"

import { Heading, RindProvider } from "@rind-ui/react"
import { useLayoutEffect } from "react"
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
  return (
    <RindProvider environment={motion === "reduce" ? { reducedMotion: true } : {}}>
      <main
        data-example-root=""
        data-skin={skin}
        data-motion={motion}
        {...(site ? { "data-skinned": "" } : {})}
        {...(theme ? { "data-rind-theme": theme } : {})}
      >
        <Heading.Level level={1}>{Example && <Example />}</Heading.Level>
      </main>
    </RindProvider>
  )
}
