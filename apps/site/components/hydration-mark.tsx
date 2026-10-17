"use client"

import { useEffect } from "react"

/** Marks `<html data-hydrated>` once React has hydrated the page: what the site audit waits for. */
export function HydrationMark() {
  useEffect(() => {
    document.documentElement.dataset["hydrated"] = ""
  }, [])
  return null
}
