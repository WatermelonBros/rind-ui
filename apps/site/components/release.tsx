"use client"

import { useEffect, useState } from "react"
import release from "@/content/generated/release.json"

const LATEST = "https://registry.npmjs.org/@rind-ui/react/latest"
let latest: Promise<string | null> | undefined

/** The version on npm now; one request per page load, `null` when offline. */
function fetchLatest(): Promise<string | null> {
  latest ??= fetch(LATEST)
    .then((r) => (r.ok ? (r.json() as Promise<{ version?: unknown }>) : null))
    .then((d) => (typeof d?.version === "string" ? d.version : null))
    .catch(() => null)
  return latest
}

const minor = (version: string) => version.replace(/\.\d+$/, "")

/**
 * The released version: the build's value first (no flash, works offline), then npm's, so a
 * release shows without redeploying the site.
 */
export function useRelease(): string {
  const [version, setVersion] = useState(release.version)
  useEffect(() => {
    fetchLatest().then((v) => v && setVersion(v))
  }, [])
  return version
}

/** Keeps every `[data-release]` in server-rendered markdown on npm's version. */
export function ReleaseSync() {
  const version = useRelease()
  useEffect(() => {
    for (const el of document.querySelectorAll<HTMLElement>("[data-release]")) {
      el.textContent = el.dataset["release"] === "minor" ? minor(version) : version
    }
  }, [version])
  return null
}
