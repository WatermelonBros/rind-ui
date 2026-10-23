"use client"

import { useEffect, useState } from "react"

/**
 * The framework the visitor reads the docs for, remembered across pages and visits (per
 * viewer, so browser storage), and shared by every part of the page that asks: picking it in
 * the sidebar updates the others at once.
 */
const KEY = "rind-framework"
const EVENT = "rind:framework"

export function useFramework(fallback = "react"): readonly [string, (id: string) => void] {
  const [id, setId] = useState(fallback)
  useEffect(() => {
    const read = () => {
      try {
        setId(localStorage.getItem(KEY) ?? fallback)
      } catch {
        setId(fallback)
      }
    }
    read()
    window.addEventListener(EVENT, read)
    return () => window.removeEventListener(EVENT, read)
  }, [fallback])
  const pick = (next: string) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // storage refused (a private window): the choice lasts for this page only
    }
    setId(next)
    window.dispatchEvent(new Event(EVENT))
  }
  return [id, pick] as const
}
