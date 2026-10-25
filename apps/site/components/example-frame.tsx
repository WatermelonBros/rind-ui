"use client"

import { Button, Heading, SegmentedControl, Tabs, ToggleGroup } from "@rind-ui/react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { exampleComponent, examples, heroName } from "@/examples"
import styles from "./example-frame.module.css"
import { useFramework } from "./framework"
import { usePhase } from "./phase"
import { zoom } from "./zoom"

type Skin = "crisp" | "juicy" | "bare" | "parts"

/** The parts an example renders: those in its stage, plus the ones it portalled elsewhere
 * (same `data-instance`), such as an open popover's content, and every part nested in those
 * (a component of its own inside the content: a field, a slider, a nested menu). */
function anatomy(stage: HTMLElement): HTMLElement[] {
  const inside = [...stage.querySelectorAll<HTMLElement>("[data-part]")]
  const ids = new Set(inside.map((el) => el.dataset["instance"]).filter(Boolean))
  const portalled = [
    ...stage.ownerDocument.querySelectorAll<HTMLElement>("[data-part][data-instance]"),
  ].filter((el) => !stage.contains(el) && ids.has(el.dataset["instance"]))
  const outside = new Set(portalled)
  for (const el of portalled) {
    for (const nested of el.querySelectorAll<HTMLElement>("[data-part]")) outside.add(nested)
  }
  return [...inside, ...outside]
}
type Tab = "react" | "vue" | "svelte" | "solid" | "angular" | "css"
const CODE_TABS = {
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  solid: "Solid",
  angular: "Angular",
  css: "Our skin CSS",
} as const

/** Build-time highlighted sources of one component's examples. */
export interface ExampleCode {
  /** example name → highlighted TSX */
  readonly code: Readonly<Record<string, { readonly html: string; readonly raw: string }>>
  /** the same examples for the other frameworks, where their packages ship them (lib/docs.ts) */
  readonly vue?: Readonly<Record<string, { readonly html: string; readonly raw: string }>>
  readonly svelte?: Readonly<Record<string, { readonly html: string; readonly raw: string }>>
  readonly solid?: Readonly<Record<string, { readonly html: string; readonly raw: string }>>
  readonly angular?: Readonly<Record<string, { readonly html: string; readonly raw: string }>>
  /** highlighted CSS of our two skins for this component */
  readonly css: { readonly html: string; readonly raw: string }
}

const SKIN_NOTE = (
  <>
    <b>Our skin, not yours.</b> This is how this site styles it; no package ships it.{" "}
    <Link prefetch={false} href="/docs/get-started/#styling">
      How styling works →
    </Link>
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
  const [framework] = useFramework("react")
  const [copied, setCopied] = useState(false)
  const skin: Skin = picked ?? phase
  // parts view: the distinct scope·part pairs the example renders, and the one being inspected
  const stage = useRef<HTMLDivElement>(null)
  const [parts, setParts] = useState<readonly string[]>([])
  const [inspect, setInspect] = useState<string | null>(null)
  // a closed overlay renders its popup parts only once opened
  const [closed, setClosed] = useState(false)
  // parts view: the stage height an open portalled popup needs (0 when none is open)
  const [reach, setReach] = useState(0)
  const [tags, setTags] = useState<readonly { x: number; y: number }[]>([])
  useEffect(() => {
    const root = stage.current
    if (skin !== "parts" || !root) return
    // an open popup is portalled, so the stage cannot grow around it: reach below the opener by
    // the popup's height, so the popup never covers the parts legend. Anchored popups only: a
    // modal one is centred on the screen, not below the opener.
    const popups = () =>
      anatomy(root)
        .filter((el) => !root.contains(el) && /^(content|popup)$/.test(el.dataset["part"] ?? ""))
        .filter((el) => el.getAttribute("aria-modal") !== "true")
    const measure = () => {
      const opener = root.querySelector<HTMLElement>('[aria-expanded="true"]')
      const popup = Math.max(0, ...popups().map((el) => el.getBoundingClientRect().height))
      const top = root.getBoundingClientRect().top
      setReach(opener && popup ? opener.getBoundingClientRect().bottom - top + popup + 48 : 0)
    }
    // the popup gets its size after it mounts (positioned, then laid out)
    const sizes = new ResizeObserver(measure)
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
      sizes.disconnect()
      for (const el of popups()) sizes.observe(el)
      measure()
      setParts((was) =>
        was.length === found.size && was.every((p) => found.has(p)) ? was : [...found],
      )
    }
    list()
    const watch = new MutationObserver(list)
    watch.observe(root.ownerDocument.body, { childList: true, subtree: true })
    return () => {
      watch.disconnect()
      sizes.disconnect()
      setReach(0)
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
    const z = zoom()
    const at: { x: number; y: number }[] = []
    for (const el of anatomy(root)) {
      if (el.dataset["scope"] !== scope || el.dataset["part"] !== part) continue
      el.dataset["anatomyOn"] = ""
      const r = el.getBoundingClientRect()
      // in the stage's own (zoomed) pixels (zoom.ts)
      const x = (r.left - box.left) / z
      const y = (r.top - box.top) / z
      // two matching parts at the same origin (a part inside another) share one label
      if (!at.some((t) => t.x === x && t.y === y)) at.push({ x, y })
    }
    // labels live in an overlay so they never move the part or get clipped by its container
    setTags(at)
  }, [inspect])
  const mod = examples[slug]
  // the hero is the module's first visible example, whatever its name
  const shownName = (hero && mod && heroName(mod)) || name
  const Example = mod && exampleComponent(mod, shownName)
  if (!Example) return null
  // the code of one tab: the example in its framework, or the skin's CSS
  const codeOf = (t: Tab) =>
    t === "css" ? source.css : t === "react" ? source.code[shownName] : source[t]?.[shownName]
  // the tabs this example has: React always, a framework once its package ships this example
  const tabs = (["react", "vue", "svelte", "solid", "angular", "css"] as const).filter(
    (t) => codeOf(t)?.raw,
  )
  const shown = tab ? codeOf(tab) : undefined
  // the visitor reads the docs for a framework this example is not written for yet: said, not
  // silently swapped for React
  const missing =
    framework === "react" || tabs.some((t) => t === framework)
      ? undefined
      : Object.entries(CODE_TABS).find(([id]) => id === framework)?.[1]

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
        {/* no source (a stale build): no button that would open nothing */}
        {source.code[shownName]?.raw && (
          <ToggleGroup.Item
            className={styles.getCode}
            pressed={tab !== null}
            // opens on the framework the visitor reads the docs for, when this example has it
            onPressedChange={(on) =>
              setTab(on ? (tabs.find((t) => t === framework) ?? "react") : null)
            }
          >
            {"</>"} Get code
          </ToggleGroup.Item>
        )}
      </div>

      <div
        ref={stage}
        className={styles.stage}
        data-view={skin}
        data-skinned=""
        data-skin={skin === "parts" ? "bare" : skin}
        data-rind-theme={`skin-${skin === "parts" ? "bare" : skin}`}
        data-inspecting={inspect ? "" : undefined}
        style={skin === "parts" && reach ? { minHeight: Math.ceil(reach) } : undefined}
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
            const next = tabs.find((t) => t === v)
            if (next) setTab(next)
          }}
        >
          <div className={styles.tabs}>
            <Tabs.List className={styles.codeList} aria-label={`${label}: code`}>
              {tabs.map((t) => (
                <Tabs.Tab key={t} className={styles.codeTab} value={t}>
                  {CODE_TABS[t]}
                </Tabs.Tab>
              ))}
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
          {tabs.map((t) => (
            <Tabs.Panel key={t} value={t}>
              <pre
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard
                tabIndex={0}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighted at build time from the site's own sources
                dangerouslySetInnerHTML={{
                  __html: `<code class="hljs">${codeOf(t)?.html ?? ""}</code>`,
                }}
              />
              {t === "react" && missing && (
                <p className={styles.cssNote}>
                  Not written for {missing} yet: this is the React version. The parts, props and{" "}
                  <code>data-*</code> attributes are the same in every framework.
                </p>
              )}
              {t === "css" && (
                <p className={styles.cssNote}>
                  Our styles for both skins, scoped by <code>[data-skin]</code>. Copy them as a
                  start, or write your own on the same attributes.
                </p>
              )}
            </Tabs.Panel>
          ))}
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
