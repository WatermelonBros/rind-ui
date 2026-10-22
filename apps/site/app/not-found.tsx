import type { Metadata } from "next"
import Link from "next/link"
import { GooFilters } from "@/components/goo"
import { LostZero } from "@/components/lost-zero"
import { Nav } from "@/components/nav"
import { PhaseProvider } from "@/components/phase"
import "./globals.css"
import "@/skins/index.css"
import styles from "./not-found.module.css"

export const metadata: Metadata = { title: "Not found" }

export default function NotFound() {
  return (
    <PhaseProvider>
      <GooFilters />
      <header>
        <Nav />
      </header>
      <main className={styles.page}>
        <p className={styles.code} aria-hidden="true">
          4<LostZero />4
        </p>
        <h1 className={styles.title}>This page is headless.</h1>
        <p className={styles.text}>No behaviour, no state, no look. Nothing here at all.</p>
        <div className={styles.ctas}>
          <Link href="/" className={styles.primary}>
            Back home
          </Link>
          <Link href="/docs/" className={styles.ghost}>
            Browse the docs
          </Link>
        </div>
      </main>
    </PhaseProvider>
  )
}
