import type { Metadata } from "next"
import localFont from "next/font/local"
import type { ReactNode } from "react"
import { HydrationMark } from "@/components/hydration-mark"

// Self-hosted (OFL, licences in fonts/): the build must work with no network.
// the fonts the first screen uses are preloaded (they land before the first layout, so nothing
// reflows: a late font moved the hero's lede and buttons by 66px on phones); "block" keeps a
// late one invisible rather than drawn twice
// only the weights the site sets (display 800/900, mono 500 to 700): every file is preloaded
const unbounded = localFont({
  src: [{ path: "../fonts/unbounded/unbounded-latin-900.woff2", weight: "900" }],
  variable: "--font-unbounded",
  display: "block",
})
const inter = localFont({
  src: [
    { path: "../fonts/inter-tight/inter-tight-latin-400.woff2", weight: "400" },
    { path: "../fonts/inter-tight/inter-tight-latin-500.woff2", weight: "500" },
    { path: "../fonts/inter-tight/inter-tight-latin-600.woff2", weight: "600" },
    { path: "../fonts/inter-tight/inter-tight-latin-700.woff2", weight: "700" },
  ],
  variable: "--font-inter",
  display: "block",
  // crisp's text only (juicy is the default): fetched when used, not on every first load
  preload: false,
})
const fredoka = localFont({
  src: [
    { path: "../fonts/fredoka/fredoka-latin-500.woff2", weight: "500" },
    { path: "../fonts/fredoka/fredoka-latin-600.woff2", weight: "600" },
    { path: "../fonts/fredoka/fredoka-latin-700.woff2", weight: "700" },
  ],
  variable: "--font-fredoka",
  display: "block",
})
const mono = localFont({
  src: [
    { path: "../fonts/jetbrains-mono/jetbrains-mono-latin-500.woff2", weight: "500" },
    { path: "../fonts/jetbrains-mono/jetbrains-mono-latin-600.woff2", weight: "600" },
  ],
  variable: "--font-mono",
  display: "block",
  // preloaded: the hero's "Browse components" is set in it, and a font that lands after the first
  // layout rewraps the hero's buttons on phones, whatever its display
})

export const metadata: Metadata = {
  metadataBase: new URL("https://rind.watermelon-studio.it"),
  title: { default: "rind — headless components", template: "%s · rind" },
  description: "Behaviour, accessibility and state for React. The look is yours.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en-US"
      data-phase="juicy"
      className={`${unbounded.variable} ${inter.variable} ${fredoka.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Before paint: pick the landing's hero component for this visit (components/home/
            skin-scene.tsx), restore the phase (no juicy flash for a crisp visitor) and, on a
            load of the landing, mark the intro (components/intro.tsx) and the sound question
            still to ask (components/sound-invite.tsx). */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script, no user input
          dangerouslySetInnerHTML={{
            __html: `var r=document.documentElement;r.dataset.hero=["switch","checkbox","button"][Math.floor(Math.random()*3)];try{var p=localStorage.getItem("rind-phase");if(p==="crisp")r.dataset.phase=p;if(location.pathname==="/"){r.setAttribute("data-sound-ask","");if(!matchMedia("(prefers-reduced-motion: reduce)").matches)r.classList.add("intro")}}catch(e){}`,
          }}
        />
      </head>
      {/* extensions (Grammarly, password managers) stamp attributes on <body> before React loads */}
      <body suppressHydrationWarning>
        {/* The site chrome lives in app/(site)/layout.tsx; app/examples has none. */}
        {children}
        <HydrationMark />
      </body>
    </html>
  )
}
