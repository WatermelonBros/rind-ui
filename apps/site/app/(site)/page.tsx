import { Hero } from "@/components/hero"
import { AnyLook } from "@/components/home/any-look"
import { Outro } from "@/components/home/outro"
import { Peel } from "@/components/home/peel"
import { ScreenReaderView } from "@/components/home/sr-view"
import { Tested } from "@/components/home/tested"
import { Wall } from "@/components/home/wall"
import { Why } from "@/components/home/why"
import { XRay } from "@/components/home/xray"
import { Marquee } from "@/components/marquee"
import { SmoothScroll } from "@/components/smooth-scroll"
import { pages } from "@/lib/docs"
// only the skins of the components the landing renders: a smaller first-paint stylesheet
import "@/skins/home.css"

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <XRay />
      <ScreenReaderView />
      <Hero>
        <Marquee items={pages.filter((p) => p.section === "components").map((p) => p.title)} />
        <Peel />
        <Why />
        <AnyLook />
        <Tested />
        <Wall />
      </Hero>
      <Outro />
    </>
  )
}
