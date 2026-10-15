import { Hero } from "@/components/hero"
import { AnyLook } from "@/components/home/any-look"
import { Outro } from "@/components/home/outro"
import { Tested } from "@/components/home/tested"
import { Wall } from "@/components/home/wall"
import { Why } from "@/components/home/why"
import { Marquee } from "@/components/marquee"
import { pages } from "@/lib/docs"

export default function Home() {
  return (
    <>
      <Hero>
        <Marquee items={pages.filter((p) => p.section === "components").map((p) => p.title)} />
        <Why />
        <AnyLook />
        <Tested />
        <Wall />
      </Hero>
      <Outro />
    </>
  )
}
