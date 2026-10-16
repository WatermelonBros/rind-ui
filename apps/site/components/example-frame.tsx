"use client"

import { Button, Heading, SegmentedControl, Tabs, Toggle } from "@rind-ui/react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { exampleComponent, examples, heroName } from "@/examples"
import styles from "./example-frame.module.css"
import { usePhase } from "./phase"

type Skin = "crisp" | "juicy" | "bare" | "parts"

/** The parts an example renders: those in its stage, plus the ones it portalled elsewhere
 * (same `data-instance`), such as an open popover's content. */
function anatomy(stage: HTMLElement): HTMLElement[] {
  const inside = [...stage.querySelectorAll<HTMLElement>("[data-part]")]
  const ids = new Set(inside.map((el) => el.dataset["instance"]).filter(Boolean))
  const outside = [
    ...stage.ownerDocument.querySelectorAll<HTMLElement>("[data-part][data-instance]"),
  ].filter((el) => !stage.contains(el) && ids.has(el.dataset["instance"]))
  return [...inside, ...outside]
}
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
    <b>Our skin, not yours.</b> This is how this site styles it; no package ships it.{" "}
    <Link href="/docs/get-started/#styling">How styling works →</Link>
  </>
)
const PARTS_NOTE = (
  <>
    <b>The anatomy.</b> Every element the component renders, labelled with its{" "}
    <code>data-scope</code> and <code>data-part</code>: the names you style.
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
  // parts view: the distinct scope·part pairs the example renders, and the one being inspected
  const stage = useRef<HTMLDivElement>(null)
  const [parts, setParts] = useState<readonly string[]>([])
  const [inspect, setInspect] = useState<string | null>(null)
  // a closed overlay renders its popup parts only once opened
  const [closed, setClosed] = useState(false)
  const [tags, setTags] = useState<readonly { x: number; y: number }[]>([])
  useEffect(() => {
    const root = stage.current
    if (skin !== "parts" || !root) return
    // portalled parts (a popover's content) live outside the stage: re-list them as they mount
    const list = () => {
      const found = new Set<string>()
      for (const el of root.ownerDocument.querySelectorAll("[data-anatomy-part]")) {
        delete (el as HTMLElement).dataset["anatomyPart"]
      }
      for (const el of anatomy(root)) {
        const part = el.dataset["part"]
        if (part && part !== "hidden-input") found.add(`${el.dataset["scope"]} · ${part}`)
        if (!root.contains(el)) el.dataset["anatomyPart"] = ""
      }
      setClosed(root.querySelector('[aria-haspopup][aria-expanded="false"]') !== null)
      setParts((was) =>
        was.length === found.size && was.every((p) => found.has(p)) ? was : [...found],
      )
    }
    list()
    const watch = new MutationObserver(list)
    watch.observe(root.ownerDocument.body, { childList: true, subtree: true })
    return () => {
      watch.disconnect()
      for (const el of root.ownerDocument.querySelectorAll("[data-anatomy-part]")) {
        delete (el as HTMLElement).dataset["anatomyPart"]
      }
    }
  }, [skin])
  useEffect(() => {
    const root = stage.current
    if (!root) return
    for (const el of root.ownerDocument.querySelectorAll<HTMLElement>("[data-anatomy-on]")) {
      delete el.dataset["anatomyOn"]
    }
    setTags([])
    if (!inspect) return
    const [scope, part] = inspect.split(" · ")
    const box = root.getBoundingClientRect()
    const at: { x: number; y: number }[] = []
    for (const el of anatomy(root)) {
      if (el.dataset["scope"] !== scope || el.dataset["part"] !== part) continue
      el.dataset["anatomyOn"] = ""
      const r = el.getBoundingClientRect()
      at.push({ x: r.left - box.left, y: r.top - box.top })
    }
    // labels live in an overlay so they never move the part or get clipped by its container
    setTags(at)
  }, [inspect])
  const mod = examples[slug]
  // the hero is the module's first visible example, whatever its name
  const shownName = (hero && mod && heroName(mod)) || name
  const Example = mod && exampleComponent(mod, shownName)
  if (!Example) return null
  const shown = tab === "css" ? source.css : source.code[shownName]

  return (
    <section
      className={styles.frame}
      data-example=""
      data-hero={hero ? "" : undefined}
      aria-label={label}
    >
      <div className={styles.bar}>
        <SegmentedControl.Root
          className={styles.views}
          aria-label={`${label}: view`}
          value={skin}
          onValueChange={(v) => {
            if (v === "crisp" || v === "juicy" || v === "bare" || v === "parts") setPicked(v)
          }}
        >
          {(["crisp", "juicy", "bare", "parts"] as const).map((s) => (
            <SegmentedControl.Item key={s} className={styles.view} value={s}>
              {s}
            </SegmentedControl.Item>
          ))}
          <SegmentedControl.Indicator className={styles.viewIndicator} />
        </SegmentedControl.Root>
        <Toggle.Root
          className={styles.getCode}
          pressed={tab !== null}
          onPressedChange={(on) => setTab(on ? "react" : null)}
        >
          {"</>"} Get code
        </Toggle.Root>
      </div>

      <div
        ref={stage}
        className={styles.stage}
        data-view={skin}
        data-skinned=""
        data-skin={skin === "parts" ? "bare" : skin}
        data-rind-theme={`skin-${skin === "parts" ? "bare" : skin}`}
        data-inspecting={inspect ? "" : undefined}
      >
        {tags.map((t) => (
          <span key={`${t.x}-${t.y}`} className={styles.tag} style={{ left: t.x, top: t.y }}>
            {inspect}
          </span>
        ))}
        <div className={styles.canvas}>
          <Heading.Level level={headingLevel}>
            <Example />
          </Heading.Level>
        </div>
      </div>

      {skin === "parts" && parts.length > 0 && (
        <ul className={styles.legend} aria-label="Parts">
          {parts.map((p) => (
            <li key={p}>
              <button
                type="button"
                className={styles.legendItem}
                aria-pressed={inspect === p}
                onPointerEnter={() => setInspect(p)}
                onPointerLeave={() => setInspect(null)}
                onFocus={() => setInspect(p)}
                onBlur={() => setInspect(null)}
              >
                {p}
              </button>
            </li>
          ))}
          {closed && (
            <li className={styles.legendHint}>Open it to list the parts it renders open.</li>
          )}
        </ul>
      )}

      {tab !== null && shown && (
        <Tabs.Root
          className={styles.code}
          value={tab}
          onValueChange={(v) => {
            if (v === "react" || v === "css") setTab(v)
          }}
        >
          <div className={styles.tabs}>
            <Tabs.List className={styles.codeList} aria-label={`${label}: code`}>
              <Tabs.Tab className={styles.codeTab} value="react">
                React
              </Tabs.Tab>
              {source.css.raw && (
                <Tabs.Tab className={styles.codeTab} value="css">
                  Our skin CSS
                </Tabs.Tab>
              )}
              <Tabs.Indicator className={styles.codeIndicator} />
            </Tabs.List>
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
          {(["react", "css"] as const).map((t) =>
            t === "css" && !source.css.raw ? null : (
              <Tabs.Panel key={t} value={t}>
                <pre
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard
                  tabIndex={0}
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighted at build time from the site's own sources
                  dangerouslySetInnerHTML={{
                    __html: `<code class="hljs">${(t === "css" ? source.css : source.code[shownName])?.html ?? ""}</code>`,
                  }}
                />
                {t === "css" && (
                  <p className={styles.cssNote}>
                    Our styles for both skins, scoped by <code>[data-skin]</code>. Copy them as a
                    start, or write your own on the same attributes.
                  </p>
                )}
              </Tabs.Panel>
            ),
          )}
        </Tabs.Root>
      )}

      {hero && (
        <p className={styles.note}>
          {skin === "parts" ? PARTS_NOTE : skin === "bare" ? BARE_NOTE : SKIN_NOTE}
        </p>
      )}
    </section>
  )
}
