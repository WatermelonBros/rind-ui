import type { Metadata } from "next"
import styles from "./legal.module.css"

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this website collects (almost nothing), why, and who else sees it.",
}

const CONTACT = "matteo@watermelon-studio.it"

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <h1>Privacy</h1>
      <p className={styles.updated}>Last updated 2026-10-18</p>
      <p>
        <strong>The short version.</strong> This website has no account, no analytics, no
        advertising and no cookies. It remembers two small preferences in your own browser, and the
        hosting provider sees your IP address to deliver the pages. That is all.
      </p>

      <h2>Who is responsible</h2>
      <p>
        The data controller is Matteo Poli, a private individual in Italy, who makes rind under the{" "}
        <a href="https://watermelon-studio.it">Watermelon Studio</a> name. There is no company
        behind it. For anything about your data, write to{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>

      <h2>Hosting</h2>
      <p>
        The site is a set of static pages hosted by Cloudflare, which processes your IP address and
        request details to deliver them and to protect the site from abuse. <strong>Why:</strong> to
        serve the site securely (legitimate interest, GDPR Art. 6(1)(f)).
      </p>

      <h2>Cookies and your browser&rsquo;s storage</h2>
      <p>
        The site sets no cookies. It stores one value in your browser, and never sends it anywhere:
      </p>
      <ul>
        <li>
          <code>rind-phase</code> (local storage): whether you picked the crisp or the juicy look,
          so the site opens in it next time. It stays until you clear your browser data.
        </li>
      </ul>
      <p>
        It only remembers a choice you made, so it needs no consent. Fonts and every other file come
        from this site, not from a third party.
      </p>

      <h2>Links out</h2>
      <p>
        GitHub, Discord and the other sites linked from here have their own privacy policies; once
        you follow a link, those apply.
      </p>

      <h2>The library</h2>
      <p>
        rind itself is code you install. It sends nothing anywhere and collects nothing. It is
        released under the MIT licence, which is also all the terms there are for using it.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask what we hold about you (on this site, nothing), and complain to your data
        protection authority; in Italy that is the Garante per la protezione dei dati personali.
      </p>
    </main>
  )
}
