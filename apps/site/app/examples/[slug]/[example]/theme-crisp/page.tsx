import "@rind-ui/theme/index.css"
import "@rind-ui/theme/presets/crisp.css"
import type { Metadata } from "next"
import { ExampleHost } from "@/components/harness/example-host"
import { exampleParams, exampleTitle, type Params } from "@/lib/harness"

export const dynamicParams = false
export const generateStaticParams = exampleParams

type Props = { params: Promise<Params> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params
  return { title: exampleTitle(p, "theme-crisp"), robots: { index: false } }
}

export default async function Page({ params }: Props) {
  const p = await params
  return <ExampleHost slug={p.slug} example={p.example} skin={"theme-crisp"} />
}
