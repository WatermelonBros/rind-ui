import type { Metadata } from "next"
import localFont from "next/font/local"
import type { ReactNode } from "react"
import { HydrationMark } from "@/components/hydration-mark"

// Self-hosted (OFL, licences in fonts/): the build must work with no network.
const unbounded = localFont({
  src: [
    { path: "../fonts/unbounded/unbounded-latin-500.woff2", weight: "500" },
    { path: "../fonts/unbounded/unbounded-latin-900.woff2", weight: "900" },
  ],
  variable: "--font-unbounded",
  display: "swap",
})
const inter = localFont({
  src: [
    { path: "../fonts/inter-tight/inter-tight-latin-400.woff2", weight: "400" },
    { path: "../fonts/inter-tight/inter-tight-latin-500.woff2", weight: "500" },
    { path: "../fonts/inter-tight/inter-tight-latin-600.woff2", weight: "600" },
    { path: "../fonts/inter-tight/inter-tight-latin-700.woff2", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
})
const fredoka = localFont({
  src: [
    { path: "../fonts/fredoka/fredoka-latin-500.woff2", weight: "500" },
    { path: "../fonts/fredoka/fredoka-latin-600.woff2", weight: "600" },
    { path: "../fonts/fredoka/fredoka-latin-700.woff2", weight: "700" },
  ],
  variable: "--font-fredoka",
  display: "swap",
})
const mono = localFont({
  src: [
    { path: "../fonts/jetbrains-mono/jetbrains-mono-latin-400.woff2", weight: "400" },
    { path: "../fonts/jetbrains-mono/jetbrains-mono-latin-500.woff2", weight: "500" },
    { path: "../fonts/jetbrains-mono/jetbrains-mono-latin-600.woff2", weight: "600" },
  ],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://rind.watermelon-studio.it"),
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
        {/* Before paint: restore the phase (no crisp flash for a juicy visitor) and, on a first
            visit of the landing, start unstyled for the intro. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script, no user input
          dangerouslySetInnerHTML={{
            __html: `try{var r=document.documentElement,p=localStorage.getItem("rind-phase");if(p==="juicy")r.dataset.phase=p;if(location.pathname==="/"&&!sessionStorage.getItem("rind-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)r.classList.add("unstyled")}catch(e){}`,
          }}
        />
      </head>
      <body>
        {/* The site chrome lives in app/(site)/layout.tsx; app/examples has none. */}
        {children}
        <HydrationMark />
      </body>
    </html>
  )
}
