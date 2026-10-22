import type { ReactNode } from "react"
import { GooFilters } from "@/components/goo"
import { Intro } from "@/components/intro"
import { Nav } from "@/components/nav"
import { PhaseProvider } from "@/components/phase"
import { Secrets } from "@/components/secrets"
import "../globals.css"

/** The site: navigation, phase, intro and the site stylesheet. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GooFilters />
      <PhaseProvider>
        <header>
          <Nav />
        </header>
        {children}
        <Secrets />
      </PhaseProvider>
      {/* after the page: its inline script copies the parsed header and main */}
      <Intro />
    </>
  )
}
