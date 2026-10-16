"use client"

import { Heading, RindProvider } from "@rind-ui/react"
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
  return (
    <RindProvider environment={motion === "reduce" ? { reducedMotion: true } : {}}>
      <main
        data-example-root=""
        data-skin={skin}
        data-motion={motion}
        {...(site ? { "data-skinned": "" } : {})}
        {...(preset || site ? { "data-rind-theme": preset ?? `skin-${skin}` } : {})}
      >
        <Heading.Level level={1}>{Example && <Example />}</Heading.Level>
      </main>
    </RindProvider>
  )
}
