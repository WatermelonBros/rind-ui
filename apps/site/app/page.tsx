import { Hero } from "@/components/hero"
import { Marquee } from "@/components/marquee"
import { pages } from "@/lib/docs"

export default function Home() {
  return (
    <>
      <Hero />
      <Marquee items={pages.filter((p) => p.section === "components").map((p) => p.title)} />
    </>
  )
}
