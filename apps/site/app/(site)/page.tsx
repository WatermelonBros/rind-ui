import { Hero } from "@/components/hero"
import { Agents } from "@/components/home/agents"
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
import release from "@/content/generated/release.json"
import { pages } from "@/lib/docs"
// only the skins of the components the landing renders: a smaller first-paint stylesheet
import "@/skins/home.css"

/** What search engines (and the AI search built on them) should understand this site to be. */
const STRUCTURED = {
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  name: "rind-ui",
  description:
    "Headless React components: behaviour, keyboard, ARIA and state, styled through data-* attributes. Every component ships a test driver for Testing Library and Playwright.",
  url: "https://rind.watermelon-studio.it",
  codeRepository: "https://github.com/WatermelonBros/rind-ui",
  programmingLanguage: ["TypeScript", "React"],
  license: "https://opensource.org/licenses/MIT",
  version: release.version,
  keywords: "headless ui, react components, accessibility, wai-aria, state machines, testing",
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: our own JSON, serialised at build time
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED) }}
      />
      <SmoothScroll />
      <XRay />
      <ScreenReaderView />
      <Hero>
        <Marquee items={pages.filter((p) => p.section === "components").map((p) => p.title)} />
        <Peel />
        {/* the bare object ends its trip here: it becomes a real component in the visitor's skin */}
        <AnyLook />
        <Why />
        <Tested />
        <Agents />
        <Wall />
      </Hero>
      <Outro />
    </>
  )
}
