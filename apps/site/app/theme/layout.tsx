import "@rind-ui/theme/index.css"
import "@rind-ui/theme/presets/crisp.css"
import type { ReactNode } from "react"
import { RindProvider } from "@/components/theme/provider"
import { sampleBrandsCss } from "@/lib/theme-brands"

const page = `body{margin:0;background:var(--rind-color-bg);color:var(--rind-color-text);font-family:var(--rind-font-sans)}
main[data-theme-page]{box-sizing:border-box;min-height:100vh;padding:var(--rind-space-6)}`

/**
 * @rind-ui/theme's own pages (tokens, contrast report, showcase), rendered by the theme alone:
 * no site skin or chrome. `?brand=calm|crisp|sample-yellow|sample-white` and
 * `?scheme=light|dark` re-skin the page before the first paint.
 */
export default function ThemeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script, no user input
        dangerouslySetInnerHTML={{
          __html: `try{var q=new URLSearchParams(location.search),r=document.documentElement,b=q.get("brand"),s=q.get("scheme");r.dataset.rindTheme=b||"calm";if(s==="light"||s==="dark")r.dataset.theme=s}catch(e){}`,
        }}
      />
      <style>{`${page}\n${sampleBrandsCss}`}</style>
      <RindProvider>
        <main data-theme-page="">{children}</main>
      </RindProvider>
    </>
  )
}
