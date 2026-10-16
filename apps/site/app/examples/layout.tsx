import type { ReactNode } from "react"

// The page's reset (the only CSS on the `none` skin) and no motion, so snapshots are stable.
const reset = `body{margin:0}[data-example-root]{box-sizing:border-box;min-height:100vh;padding:24px}
*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}`

/** The examples harness: one example per page, nothing of the site around it. */
export default function ExamplesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* ?scheme=light|dark before the first paint */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script, no user input
        dangerouslySetInnerHTML={{
          __html: `try{var s=new URLSearchParams(location.search).get("scheme"),r=document.documentElement;if(s==="light"||s==="dark"){r.dataset.theme=s;r.style.colorScheme=s}}catch(e){}`,
        }}
      />
      <style>{reset}</style>
      {children}
    </>
  )
}
