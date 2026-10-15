import type { Metadata } from "next"
import { Fredoka, Inter_Tight, JetBrains_Mono, Unbounded } from "next/font/google"
import type { ReactNode } from "react"
import { GooFilters } from "@/components/goo"
import { Nav } from "@/components/nav"
import { PhaseProvider } from "@/components/phase"
import "./globals.css"
import "@/skins/index.css"

const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["500", "900"],
  variable: "--font-unbounded",
})
const inter = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
})
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
})
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: { default: "rind — headless components", template: "%s · rind" },
  description: "Behaviour, accessibility and state for React. The look is yours.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-phase="crisp"
      className={`${unbounded.variable} ${inter.variable} ${fredoka.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Restore the phase before paint, so a juicy visitor never sees a crisp flash. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script, no user input
          dangerouslySetInnerHTML={{
            __html: `try{var p=localStorage.getItem("rind-phase");if(p==="juicy")document.documentElement.dataset.phase=p}catch(e){}`,
          }}
        />
      </head>
      <body>
        <GooFilters />
        <PhaseProvider>
          <Nav />
          {children}
        </PhaseProvider>
      </body>
    </html>
  )
}
