"use client"

import { Button, Heading, Toggle } from "@rind-ui/react"
import Link from "next/link"
import { useState } from "react"
import { exampleComponent, examples } from "@/examples"
import styles from "./example-frame.module.css"
import { usePhase } from "./phase"

type Skin = "crisp" | "juicy" | "bare"
type Tab = "react" | "css"

/** Build-time highlighted sources of one component's examples. */
export interface ExampleCode {
  /** example name → highlighted TSX */
  readonly code: Readonly<Record<string, { readonly html: string; readonly raw: string }>>
  /** highlighted CSS of our two skins for this component */
  readonly css: { readonly html: string; readonly raw: string }
}

const SKIN_NOTE = (
  <>
    <b>Our skin, not yours.</b> This is how rind.dev styles it; no package ships it.{" "}
    <Link href="/docs/get-started/#styling">How styling works →</Link>
  </>
)
const BARE_NOTE = (
  <>
    <b>Minimal on purpose.</b> Just enough neutral CSS to show the parts and their states. The
    package itself ships no CSS: you style the <code>data-*</code> attributes.
  </>
)

/** One live example in our skins or bare, with its code one click away. */
export function ExampleFrame({
  slug,
  name,
  source,
  label,
  headingLevel,
  hero = false,
}: {
  slug: string
  name: string
  source: ExampleCode
  /** accessible name of the frame, unique on the page */
  label: string
  /** level of the headings the example renders, so they fit the page's outline */
  headingLevel: 2 | 3 | 4 | 5
  hero?: boolean
}) {
  const { phase } = usePhase()
  const [picked, setPicked] = useState<Skin | null>(null)
  const [tab, setTab] = useState<Tab | null>(null)
  const [copied, setCopied] = useState(false)
  const skin: Skin = picked ?? phase
  const mod = examples[slug]
  const Example = mod && exampleComponent(mod, name)
  if (!Example) return null
  const shown = tab === "css" ? source.css : source.code[name]

  return (
    <section
      className={styles.frame}
      data-example=""
      data-hero={hero ? "" : undefined}
      aria-label={label}
    >
      <div className={styles.bar}>
        <div className={styles.views}>
          {(["crisp", "juicy", "bare"] as const).map((s) => (
            <Toggle.Root
              key={s}
              className={styles.view}
              pressed={skin === s}
              onPressedChange={() => setPicked(s)}
            >
              {s}
              <span className={styles.visuallyHidden}> skin</span>
            </Toggle.Root>
          ))}
        </div>
        <Toggle.Root
          className={styles.getCode}
          pressed={tab !== null}
          onPressedChange={(on) => setTab(on ? "react" : null)}
        >
          {"</>"} Get code
        </Toggle.Root>
      </div>

      <div className={styles.stage} data-view={skin} data-skin={skin}>
        <div className={styles.canvas}>
          <Heading.Level level={headingLevel}>
            <Example />
          </Heading.Level>
        </div>
      </div>

      {tab !== null && shown && (
        <div className={styles.code}>
          <div className={styles.tabs}>
            <Toggle.Root
              className={styles.codeTab}
              pressed={tab === "react"}
              onPressedChange={() => setTab("react")}
            >
              React
            </Toggle.Root>
            {source.css.raw && (
              <Toggle.Root
                className={styles.codeTab}
                pressed={tab === "css"}
                onPressedChange={() => setTab("css")}
              >
                Our skin CSS
              </Toggle.Root>
            )}
            <Button
              className={styles.copy}
              onPress={() =>
                navigator.clipboard?.writeText(shown.raw).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1400)
                })
              }
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {/* A scrollable block must be reachable by keyboard: the region holds the focus. */}
          <section
            className={styles.codeScroll}
            aria-label={`${label}: ${tab === "css" ? "skin CSS" : "code"}`}
          >
            <pre
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard
              tabIndex={0}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighted at build time from the site's own sources
              dangerouslySetInnerHTML={{ __html: `<code class="hljs">${shown.html}</code>` }}
            />
          </section>
          {tab === "css" && (
            <p className={styles.cssNote}>
              Our styles for both skins, scoped by <code>[data-skin]</code>. Copy them as a start,
              or write your own on the same attributes.
            </p>
          )}
        </div>
      )}

      {hero && <p className={styles.note}>{skin === "bare" ? BARE_NOTE : SKIN_NOTE}</p>}
    </section>
  )
}
