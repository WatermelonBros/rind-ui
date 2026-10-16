"use client"

import { Heading, RindProvider } from "@rind-ui/react"
import { harnessExample, type Skin } from "@/examples/harness"

/** One example alone on the page: no site chrome, reduced motion forced. */
export function ExampleHost({
  slug,
  example,
  skin,
}: {
  slug: string
  example: string
  skin: Skin
}) {
  const Example = harnessExample(slug, example)
  const preset = skin === "theme-calm" ? "calm" : skin === "theme-crisp" ? "crisp" : undefined
  const site = skin === "bare" || skin === "crisp" || skin === "juicy"
  return (
    <RindProvider environment={{ reducedMotion: true }}>
      <main
        data-example-root=""
        data-skin={skin}
        {...(site ? { "data-skinned": "" } : {})}
        {...(preset || site ? { "data-rind-theme": preset ?? `skin-${skin}` } : {})}
      >
        <Heading.Level level={1}>{Example && <Example />}</Heading.Level>
      </main>
    </RindProvider>
  )
}
