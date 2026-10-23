"use client"

import { useEffect, useState } from "react"
import { cue } from "./sound"

/**
 * The copy button on every rendered code block (lib/docs.ts writes it next to the block): one
 * listener for all of them. The label says "Copied" for a moment and a polite status announces
 * it; the code copied is the block's text as shown.
 */
export function CodeCopy() {
  const [said, setSaid] = useState("")
  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      const button = e.target instanceof Element ? e.target.closest("[data-code-copy]") : null
      const pre = button?.parentElement?.querySelector("pre")
      if (!(button instanceof HTMLButtonElement) || !pre) return
      try {
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ""))
      } catch {
        setSaid("Copying is not allowed here")
        return
      }
      button.textContent = "Copied"
      button.setAttribute("data-copied", "")
      setSaid("Copied")
      cue("pass")
      window.setTimeout(() => {
        button.textContent = "Copy"
        button.removeAttribute("data-copied")
        setSaid("")
      }, 1600)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])
  return (
    <p className="visually-hidden" role="status">
      {said}
    </p>
  )
}
