import type { ReactNode } from "react"
import { GooFilters } from "@/components/goo"
import { Intro } from "@/components/intro"
import { Nav } from "@/components/nav"
import { PhaseProvider } from "@/components/phase"
import "../globals.css"
import "@/skins/index.css"

/** The site: navigation, phase, intro and the site stylesheet. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GooFilters />
      <Intro />
      <PhaseProvider>
        <header>
          <Nav />
        </header>
        {children}
      </PhaseProvider>
    </>
  )
}
