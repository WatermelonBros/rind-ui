/// <reference types="node" />
// Theme lint (design-tokens, theme-variants): the component stylesheets obey the token tiers
// and the cascade layer. Every failure names file and line. The checkers are also run on bad
// fixture strings, so the lint itself is tested.
import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

export interface Violation {
  readonly file: string
  readonly line: number
  readonly rule: string
  readonly message: string
}

// Tier-2 categories, tier 1 (brand) and the icon category (theme-icons).
const categories = new Set(
  "color space size radius text font leading tracking shadow duration ease focus border brand icon hit".split(
    " ",
  ),
)
// Variables written by core at runtime (positioning, scroll lock, animation).
const runtime =
  /^(x|y|position|available-.+|anchor-.+|transform-origin|arrow-.+|collision-padding|scrollbar-width|pop-from|[a-z-]+-content-(?:height|width))$/

const named = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet
brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue
darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange
darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise
darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen
fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred
indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta
maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple
red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet
wheat white whitesmoke yellow yellowgreen`.split(/\s+/),
)
const system = new Set(
  `accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext
field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem
selecteditemtext visitedtext`.split(/\s+/),
)

type Event =
  | { kind: "rule"; prelude: string; block: boolean; stack: readonly string[]; line: number }
  | { kind: "decl"; prop: string; value: string; stack: readonly string[]; line: number }

/** Comment-, string- and url()-blanked CSS (line breaks kept), as rule and declaration events. */
function parse(css: string): Event[] {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => `"${" ".repeat(m.length - 2)}"`)
    .replace(/url\([^)]*\)/g, (m) => `url(${" ".repeat(m.length - 5)})`)
  const events: Event[] = []
  const stack: string[] = []
  let start = 0
  let line = 1
  let startLine = 1
  let parens = 0
  const flush = (end: number) => {
    const chunk = text.slice(start, end)
    const lead = chunk.length - chunk.trimStart().length
    const at = startLine + chunk.slice(0, lead).split("\n").length - 1
    return { chunk: chunk.trim(), at }
  }
  for (let i = 0; i <= text.length; i++) {
    const c = text[i]
    if (c === "(") parens++
    else if (c === ")") parens--
    if (i === text.length || (parens <= 0 && (c === "{" || c === "}" || c === ";"))) {
      const { chunk, at } = flush(i)
      if (c === "{") {
        events.push({ kind: "rule", prelude: chunk, block: true, stack: [...stack], line: at })
        stack.push(chunk)
      } else if (chunk !== "") {
        const colon = chunk.indexOf(":")
        if (chunk.startsWith("@")) {
          events.push({ kind: "rule", prelude: chunk, block: false, stack: [...stack], line: at })
        } else if (colon > 0) {
          const prop = chunk.slice(0, colon).trim()
          events.push({
            kind: "decl",
            prop,
            value: chunk.slice(colon + 1).trim(),
            stack: [...stack],
            line: at,
          })
        }
      }
      if (c === "}") stack.pop()
      start = i + 1
      startLine = line + (c === "\n" ? 1 : 0)
    }
    if (c === "\n") line++
    if (start === i + 1) startLine = line
  }
  return events
}

const isForced = (stack: readonly string[]) =>
  stack.some((p) => /^@media[^{]*\(\s*forced-colors\s*:\s*active\s*\)/.test(p))

function literalColour(value: string, forced: boolean): string | undefined {
  const hex = /#[0-9a-fA-F]{3,8}\b/.exec(value)
  if (hex) return hex[0]
  for (const m of value.matchAll(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g)) {
    let depth = 1
    let i = (m.index ?? 0) + m[0].length
    const from = i
    for (; i < value.length && depth > 0; i++) {
      if (value[i] === "(") depth++
      else if (value[i] === ")") depth--
    }
    if (!value.slice(from, i).includes("var(")) return value.slice(m.index, i)
  }
  for (const w of value.toLowerCase().matchAll(/(?<![\w-])[a-z]+(?![\w-])/g)) {
    if (named.has(w[0])) return w[0]
    if (system.has(w[0]) && !forced) return `${w[0]} (system colours only in forced-colors)`
  }
  return undefined
}

/**
 * Lints one stylesheet. `component`: a component stylesheet (must sit in rind.components, no
 * brand reads, no literal colours); tokens.css and the like only get the tier-3 rules.
 */
export function lint(
  file: string,
  css: string,
  opts: { component: boolean; tier2?: readonly string[] },
): Violation[] {
  const out: Violation[] = []
  const add = (line: number, rule: string, message: string) =>
    out.push({ file, line, rule, message })
  const scope = file.replace(/^.*\//, "").replace(/\.css$/, "")
  for (const e of parse(css)) {
    if (e.kind === "rule") {
      const top = e.stack.length === 0
      const allowed = e.block
        ? e.prelude === "@layer rind.components"
        : /^@(import|layer)\b/.test(e.prelude)
      if (opts.component && top && !allowed)
        add(e.line, "layer", `\`${e.prelude}\` is outside @layer rind.components`)
      if (!e.prelude.startsWith("@")) {
        const selector = e.prelude.replace(/\[[^\]]*\]/g, "[]")
        const cls = /(?<![\w\d-])\.-?[a-zA-Z_][\w-]*/.exec(selector)
        if (cls) add(e.line, "class", `class selector ${cls[0]} (select on data-* attributes)`)
      }
      continue
    }
    const forced = isForced(e.stack)
    if (e.prop.startsWith("--rind-")) {
      const name = e.prop.slice("--rind-".length)
      const tier2 = opts.tier2?.includes(e.prop)
      const category = name.split("-")[0] ?? ""
      if (categories.has(category) || runtime.test(name)) {
        // A scope named like a category would declare a semantic name from tier 3.
        if (opts.component && categories.has(scope) && category === scope && !tier2)
          add(
            e.line,
            "collision",
            `${e.prop} is declared by scope \`${scope}\`, a semantic category`,
          )
        if (tier2 && opts.component && categories.has(scope))
          add(e.line, "collision", `${e.prop} collides with the semantic token ${e.prop}`)
      } else {
        add(e.line, "declared-tier3", `${e.prop} is a component token: read it, never declare it`)
      }
    }
    for (const m of e.value.matchAll(/var\(\s*--rind-brand-[\w-]*/g))
      if (opts.component)
        add(e.line, "brand-read", `component stylesheet reads ${m[0].slice(4).trim()}`)
    if (opts.component && !e.prop.startsWith("--rind-pop")) {
      const lit = literalColour(e.value, forced)
      if (lit) add(e.line, "literal-colour", `literal colour ${lit} (use a role token)`)
    }
  }
  return out
}

const dir = new URL("./", import.meta.url)
const fmt = (v: Violation[]) => v.map((x) => `${x.file}:${x.line} [${x.rule}] ${x.message}`)
const files = readdirSync(dir).filter((f) => f.endsWith(".css") && f !== "icons.css")
const semantic = [
  ...readFileSync(new URL("tokens.css", dir), "utf8").matchAll(/(--rind-[a-z0-9-]+)\s*:/g),
].map((m) => m[1] as string)

describe("theme lint on the stylesheets", () => {
  for (const f of files.filter((f) => f !== "index.css")) {
    it(`${f} obeys the token tiers and the layer`, () => {
      const css = readFileSync(new URL(f, dir), "utf8")
      // fonts.css only declares @font-face (in rind.tokens); it styles no part.
      const component = f !== "tokens.css" && f !== "fonts.css"
      expect(fmt(lint(`src/${f}`, css, { component, tier2: semantic }))).toEqual([])
    })
  }
})

describe("theme lint checkers", () => {
  const bad = (css: string, file = "src/button.css") =>
    lint(file, css, { component: true, tier2: semantic }).map((v) => `${v.rule}@${v.line}`)
  const wrap = (body: string) => `@layer rind.components {\n${body}\n}`

  it("accepts a conforming stylesheet", () => {
    expect(
      bad(
        wrap(
          `:where([data-scope="button"]) {\n  color: var(--rind-button-fg, var(--rind-color-text));\n  border: 1px solid transparent;\n}`,
        ),
      ),
    ).toEqual([])
    expect(
      bad(
        wrap(
          "@media (forced-colors: active) {\n  [data-scope] { outline-color: Highlight; background: transparent }\n}",
        ),
      ),
    ).toEqual([])
  })

  it("flags rules outside @layer rind.components, with the line", () => {
    expect(bad(`/* c */\n[data-scope] { color: inherit }`)).toEqual(["layer@2"])
    expect(bad(`@layer rind.tokens {\n  [data-scope] { color: inherit }\n}`)).toEqual(["layer@1"])
  })

  it("flags a declared tier-3 token", () => {
    expect(bad(wrap(`[data-scope="button"] {\n  --rind-button-radius: 0;\n}`))).toEqual([
      "declared-tier3@3",
    ])
  })

  it("allows declaring tier-2, brand-free local and runtime variables", () => {
    expect(
      bad(
        wrap(
          `[data-size] {\n  --rind-size-control: var(--rind-size-sm);\n  --rind-pop-from: none;\n}`,
        ),
      ),
    ).toEqual([])
  })

  it("flags a read of a brand input", () => {
    expect(bad(wrap(`[data-scope] {\n  color: var(--rind-brand-accent);\n}`))).toEqual([
      "brand-read@3",
    ])
  })

  it("flags literal colours", () => {
    for (const v of [
      "#fff",
      "#1a2b3c",
      "rgb(0 0 0)",
      "hsl(10 10% 10%)",
      "oklch(0.5 0.1 20)",
      "color(srgb 1 0 0)",
      "red",
      "RebeccaPurple",
      "Canvas",
      "1px solid #abc",
    ])
      expect(bad(wrap(`[data-scope] {\n  color: ${v};\n}`)), v).toEqual(["literal-colour@3"])
    expect(bad(wrap(`[data-scope] {\n  color: oklch(from var(--x) l c h);\n}`))).toEqual([])
    for (const v of ["transparent", "currentcolor", "inherit"])
      expect(bad(wrap(`[data-scope] {\n  color: ${v};\n}`)), v).toEqual([])
  })

  it("allows system colours only in forced-colors", () => {
    expect(
      bad(wrap(`@media (forced-colors: active) {\n  [data-scope] { color: GrayText }\n}`)),
    ).toEqual([])
    expect(
      bad(wrap(`@media (prefers-contrast: more) {\n  [data-scope] { color: GrayText }\n}`)),
    ).toEqual(["literal-colour@3"])
  })

  it("flags class selectors but not attribute values", () => {
    expect(bad(wrap(`.btn {\n  color: inherit;\n}`))).toEqual(["class@2"])
    expect(bad(wrap(`[data-scope="a.b"]:not(.on) {\n  color: inherit;\n}`))).toEqual(["class@2"])
    expect(bad(wrap(`[data-scope="a.b"] {\n  color: inherit;\n}`))).toEqual([])
  })

  it("Name collision is rejected", () => {
    // A scope called `text` declaring the semantic token --rind-text-sm.
    const v = lint("src/text.css", wrap(`[data-scope="text"] {\n  --rind-text-sm: 1px;\n}`), {
      component: true,
      tier2: ["--rind-text-sm"],
    })
    expect(v.map((x) => x.rule)).toContain("collision")
    expect(v.find((x) => x.rule === "collision")?.message).toContain("--rind-text-sm")
  })

  it("does not read comments, strings or url() as CSS", () => {
    expect(
      bad(
        wrap(
          `/* .a { color: red } */\n[data-scope] {\n  content: "red #fff";\n  mask-image: url("data:image/svg+xml,%3Csvg fill='%23fff'/%3E");\n}`,
        ),
      ),
    ).toEqual([])
  })
})
