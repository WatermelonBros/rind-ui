import "@/skins/index.css"
import type { Metadata } from "next"
import { ExampleHost } from "@/components/harness/example-host"
import { exampleMotion, exampleParams, exampleTitle, type Params } from "@/lib/harness"

const siteSkins = ["bare", "crisp", "juicy"] as const
export const dynamicParams = false
export const generateStaticParams = () =>
  exampleParams().flatMap((p) => siteSkins.map((skin) => ({ ...p, skin })))

type Props = { params: Promise<Params & { skin: (typeof siteSkins)[number] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params
  return { title: exampleTitle(p, p.skin), robots: { index: false } }
}

export default async function Page({ params }: Props) {
  const p = await params
  return <ExampleHost slug={p.slug} example={p.example} skin={p.skin} motion={exampleMotion(p)} />
}
