import styles from "./home.module.css"
import { Reveal } from "./reveal"

const FEATURES = [
  {
    title: "Headless",
    text: "Behaviour, keyboard, ARIA and state. No CSS ships, so the look is entirely yours.",
    visual: (
      <div className={styles.vSkins} aria-hidden="true">
        <span data-v="bare">Save</span>
        <span data-v="crisp">Save</span>
        <span data-v="juicy">Save</span>
      </div>
    ),
  },
  {
    title: "Accessible by default",
    text: "Every component follows its WAI-ARIA pattern and is checked against real screen readers.",
    visual: (
      <div className={styles.vKeys} aria-hidden="true">
        <kbd>Tab</kbd>
        <kbd>Enter</kbd>
        <kbd>Space</kbd>
        <kbd>←</kbd>
        <kbd>→</kbd>
      </div>
    ),
  },
  {
    title: "State machines inside",
    text: "Each component is a declared state machine, so behaviour is predictable and walkable.",
    visual: (
      <svg className={styles.vGraph} viewBox="0 0 220 70" aria-hidden="true">
        <path d="M40 35 H110 M130 35 H190" />
        <circle cx="30" cy="35" r="14" />
        <circle cx="120" cy="35" r="14" />
        <circle cx="200" cy="35" r="14" />
        <circle className={styles.vToken} cx="30" cy="35" r="6" />
      </svg>
    ),
  },
  {
    title: "Tests in the box",
    text: "Every component ships a driver for Testing Library and Playwright. Same test, both runners.",
    visual: (
      <pre className={styles.vCode} aria-hidden="true">
        <span>await</span> faq.expand(<b>"Returns"</b>)
      </pre>
    ),
  },
  {
    title: "One core, every framework",
    text: "The behaviour lives in a framework-free core. React today, more on the same core next.",
    visual: (
      <div className={styles.vFw} aria-hidden="true">
        <span data-on="">React</span>
        <span>Vue</span>
        <span>Svelte</span>
        <span>Solid</span>
      </div>
    ),
  },
  {
    title: "Made for agents",
    text: "The whole API is generated into llms.txt, and drivers let an assistant check its own work.",
    visual: (
      <pre className={styles.vCode} aria-hidden="true">
        <span>#</span> rind-ui
        <i />
      </pre>
    ),
  },
] as const

export function Why() {
  return (
    <div className={styles.band} data-band="paper">
      <section className={styles.section} aria-labelledby="why-title">
        <Reveal>
          <p className={styles.kicker}>Why rind</p>
          <h2 id="why-title" className={styles.h2}>
            Everything but the look.
          </h2>
        </Reveal>
        <div className={styles.features}>
          {FEATURES.map((f) => (
            <Reveal key={f.title} className={styles.feature}>
              {f.visual}
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  )
}
