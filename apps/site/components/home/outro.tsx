import Link from "next/link"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

export function Outro() {
  return (
    <footer className={styles.outro}>
      <Reveal>
        <p className={styles.outroTitle}>
          Build the look.
          <br />
          We did the rest.
        </p>
        <div className={styles.outroCtas}>
          <Link href="/docs/get-started/" className={styles.outroPrimary}>
            Get started →
          </Link>
          <a href="https://github.com/WatermelonBros/rind-ui" className={styles.outroGhost}>
            GitHub
          </a>
        </div>
      </Reveal>
      <div className={styles.outroBottom}>
        <span>rind · headless components by Watermelon</span>
        <span>MIT</span>
      </div>
    </footer>
  )
}
