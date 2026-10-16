import harness from "@/content/generated/harness.json"
import { type Skin, skins } from "@/examples/harness"

export type Params = { slug: string; example: string }

/** Every example of the harness, for `generateStaticParams`. */
export const exampleParams = (): Params[] => harness.map(({ slug, example }) => ({ slug, example }))

/** `/examples/<slug>/<example>/<skin>/`; the `none` skin has no segment. */
export const exampleUrl = ({ slug, example }: Params, skin: Skin) =>
  skin === "none" ? `/examples/${slug}/${example}/` : `/examples/${slug}/${example}/${skin}/`

/** Whether the example keeps real motion (`motion: "keep"`) or runs reduced. */
export const exampleMotion = ({ slug, example }: Params): "keep" | "reduce" =>
  harness.find((e) => e.slug === slug && e.example === example)?.motion === "keep"
    ? "keep"
    : "reduce"

export const exampleTitle = ({ slug, example }: Params, skin: Skin) => {
  const entry = harness.find((e) => e.slug === slug && e.example === example)
  return `${entry?.title ?? example} · ${slug} (${skin})`
}

/** /examples/index.json: what the tests iterate. */
export const harnessIndex = () =>
  harness.map((e) => ({
    ...e,
    urls: Object.fromEntries(skins.map((skin) => [skin, exampleUrl(e, skin)])),
  }))
