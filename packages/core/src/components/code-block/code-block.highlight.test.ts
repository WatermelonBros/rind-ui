// biome-ignore-all lint/suspicious/noTemplateCurlyInString: JS source under test, not templates
import { describe, expect, it } from "vitest"
import { codeBlockTokens, codeGrammars, resolveGrammar } from "./code-block.grammars"
import {
  type CodeGrammar,
  type CodeTokenType,
  highlightCode,
  tokenize,
} from "./code-block.highlight"
import { splitLines } from "./code-block.lines"

type Lang = keyof typeof codeGrammars
const toks = (code: string, lang: Lang) => tokenize(code, codeGrammars[lang])
/** The texts of every token of `type`, in order. */
const of = (code: string, lang: Lang, type: CodeTokenType) =>
  toks(code, lang)
    .filter((t) => t.token === type)
    .map((t) => t.text)
const typeOf = (code: string, lang: Lang, text: string) =>
  toks(code, lang).find((t) => t.text === text)?.token

describe("tokenize: the text is the source", () => {
  it.each(Object.keys(codeGrammars) as Lang[])("%s keeps every character", (lang) => {
    const code = 'a = `x ${ {b: "}"} } y` / 2 /re/g <div a="1">t</div>\r\n# c /* d\n*/ $X'
    expect(
      toks(code, lang)
        .map((t) => t.text)
        .join(""),
    ).toBe(code.replace(/\r\n?/g, "\n"))
  })
})

describe("js / ts", () => {
  it("template literals: nested ${} with braces, strings and backticks", () => {
    const code = '`a ${ {k: `in ${x}`, s: "}"} } b`'
    expect(of(code, "ts", "string")).toEqual(["`", "a ", "`", "in ", "`", '"}"', " b", "`"])
    expect(typeOf(code, "ts", "k")).toBeUndefined()
    expect(of(code, "ts", "punctuation")).toContain("${")
  })

  it("regex vs division by the previous token", () => {
    expect(of("const r = /a\\/b[/]/gi", "js", "regex")).toEqual(["/a\\/b[/]/gi"])
    expect(of("a / b / c", "js", "regex")).toEqual([])
    expect(of("f(x) / 2", "js", "regex")).toEqual([])
    expect(of("return /x/.test(s)", "js", "regex")).toEqual(["/x/"])
    expect(of("arr[0] /2/ 1", "js", "regex")).toEqual([])
  })

  it("strings and comments do not nest into each other", () => {
    expect(of('"/* no */" // "no"', "js", "comment")).toEqual(['// "no"'])
    expect(of("'it\\'s' /* 'x' */", "js", "string")).toEqual(["'it\\'s'"])
  })

  it("keywords, functions, properties, types", () => {
    const code = "export interface A { f(): string }\nconst x: Map<string, B> = obj.run(new Date())"
    expect(of(code, "ts", "keyword")).toEqual(["export", "interface", "const", "new"])
    expect(of(code, "ts", "function")).toEqual(["f", "run", "Date"])
    expect(of(code, "ts", "type")).toEqual(["A", "string", "Map", "string", "B"])
    expect(of("a.b.c", "js", "property")).toEqual(["b", "c"])
    expect(of("0xff + 1_000 + .5e3 + 10n", "js", "number")).toEqual([
      "0xff",
      "1_000",
      ".5e3",
      "10n",
    ])
  })

  it("interface is a keyword in ts only", () => {
    expect(typeOf("interface", "ts", "interface")).toBe("keyword")
    expect(typeOf("interface", "js", "interface")).toBeUndefined()
  })
})

describe("jsx / tsx", () => {
  it("JSX text is plain: an apostrophe opens no string", () => {
    const code = 'const a = <p className="x">don\'t {name}</p>'
    expect(of(code, "tsx", "string")).toEqual(['"x"'])
    expect(of(code, "tsx", "tag")).toEqual(["p", "p"])
    expect(of(code, "tsx", "attr")).toEqual(["className"])
    expect(toks(code, "tsx").some((t) => t.text.includes("don't") && !t.token)).toBe(true)
  })

  it("nested elements, fragments, self-closing tags and expressions", () => {
    const code = "return (<>\n  <A.B on={() => f({a: 1})} />\n  <b>{x ? <i>y</i> : 'z'}</b>\n</>)"
    expect(of(code, "jsx", "tag")).toEqual(["A.B", "b", "i", "i", "b"])
    expect(of(code, "jsx", "string")).toEqual(["'z'"])
    expect(of(code, "jsx", "function")).toEqual(["f"])
  })

  it("< after an operand compares; generics stay code", () => {
    expect(of("a < b && c > d", "tsx", "tag")).toEqual([])
    expect(of("useState<string>(x)", "tsx", "tag")).toEqual([])
    expect(of("useState<string>(x)", "tsx", "function")).toEqual(["useState"])
  })
})

describe("review regressions (#151)", () => {
  it("a generic arrow's type parameters open no JSX", () => {
    for (const code of [
      "const id = <T,>(x: T) => x\nconst n = 1",
      "const f = <T extends U>(x: T) => x\nconst n = 1",
    ]) {
      expect(of(code, "tsx", "tag"), code).toEqual([])
      expect(of(code, "tsx", "keyword"), code).toContain("const")
      expect(of(code, "tsx", "number"), code).toEqual(["1"])
    }
    expect(of("const a = <T>x</T>", "tsx", "tag")).toEqual(["T", "T"])
  })

  it("=>, &&, || and ?? do not swallow a following tag", () => {
    for (const code of [
      "items.map(i=><li>{i}</li>)",
      "ok&&<li>{i}</li>",
      "ok||<li>{i}</li>",
      "x??<li>{i}</li>",
      "ok?<li>{i}</li>:null",
    ]) {
      expect(of(code, "tsx", "tag"), code).toEqual(["li", "li"])
      expect(of(code, "tsx", "regex"), code).toEqual([])
    }
    expect(of("a => b && c", "ts", "operator")).toEqual(["=>", "&&"])
    expect(of("a <= b << 2", "ts", "operator")).toEqual(["<=", "<<"])
  })

  it("postfix ++ and -- are operands: the next / divides", () => {
    expect(of("x++ / 2 / y", "js", "regex")).toEqual([])
    expect(of("x-- / 2 / y", "js", "regex")).toEqual([])
  })

  it("bash: # starts a comment only at the start of a word", () => {
    expect(of("echo a#b c # d", "bash", "comment")).toEqual(["# d"])
    expect(of("x=1;# c", "bash", "comment")).toEqual(["# c"])
    expect(of("# top", "bash", "comment")).toEqual(["# top"])
  })

  it("css: a colon before a value is no pseudo", () => {
    const code = "@media (min-width:600px) {}\na::before:hover { top: 0 }"
    expect(of(code, "css", "keyword")).toEqual(["@media", "::before", ":hover"])
    expect(of(code, "css", "number")).toContain("600px")
  })

  it("codeBlockTokens: lines win, html renders none, else the language, unknown none", () => {
    const own = [[{ text: "x", token: "string" as const }]]
    expect(codeBlockTokens({ code: "x", language: "ts", lines: own })).toBe(own)
    expect(codeBlockTokens({ code: "x", language: "ts", html: {} })).toBeUndefined()
    expect(codeBlockTokens({ code: "const", language: "ts" })).toEqual([
      [{ text: "const", token: "keyword" }],
    ])
    expect(codeBlockTokens({ code: "x", language: "cobol" })).toBeUndefined()
  })
})

describe("css, html, json, bash", () => {
  it("css: selectors, properties, values, nested blocks, custom properties", () => {
    const code =
      ".a > b:hover { color: var(--x, #fff); margin: -1.5rem 0 !important; @media (x) { .c { top: 0 } } }"
    expect(of(code, "css", "property")).toEqual(["color", "margin", "top"])
    expect(of(code, "css", "variable")).toEqual(["--x"])
    expect(of(code, "css", "number")).toEqual(["#fff", "-1.5rem", "0", "0"])
    expect(of(code, "css", "function")).toEqual(["var"])
    expect(of(code, "css", "attr")).toEqual([".a", ".c"])
    expect(of("/* a { b: c } */", "css", "comment")).toEqual(["/* a { b: c } */"])
  })

  it("html: tags, attributes, quoted values with >, comments, entities", () => {
    const code = "<!-- <a> -->\n<a href=\"x>y\" data-x='1' hidden>t &amp; u</a>"
    expect(of(code, "html", "comment")).toEqual(["<!-- <a> -->"])
    expect(of(code, "html", "tag")).toEqual(["a", "a"])
    expect(of(code, "html", "attr")).toEqual(["href", "data-x", "hidden"])
    expect(of(code, "html", "string")).toEqual(['"x>y"', "'1'"])
    expect(of(code, "html", "keyword")).toEqual(["&amp;"])
  })

  it("json: keys are properties, escaped quotes stay in the string", () => {
    const code = '{"a\\"b": "c:d", "n": -1.5e2, "t": true}'
    expect(of(code, "json", "property")).toEqual(['"a\\"b"', '"n"', '"t"'])
    expect(of(code, "json", "string")).toEqual(['"c:d"'])
    expect(of(code, "json", "number")).toEqual(["-1.5e2"])
    expect(of(code, "json", "keyword")).toEqual(["true"])
  })

  it("bash: comments, variables inside double quotes only, flags, keywords", () => {
    const code = "if [ -n \"$HOME/${X}\" ]; then echo '$no' # c\nfi"
    expect(of(code, "bash", "variable")).toEqual(["$HOME", "${X}"])
    expect(of(code, "bash", "string")).toEqual(['"', "/", '"', "'$no'"])
    expect(of(code, "bash", "comment")).toEqual(["# c"])
    expect(of(code, "bash", "keyword")).toEqual(["if", "then", "fi"])
    expect(of(code, "bash", "attr")).toEqual(["-n"])
    expect(of("echo $#", "bash", "comment")).toEqual([])
  })
})

describe("highlightCode", () => {
  it("splits a multi-line token per line and keeps its type", () => {
    const code = "a /* one\ntwo\n*/ b\nconst s = `x\ny`"
    const lines = highlightCode(code, codeGrammars.ts)
    expect(lines.map((l) => l.map((t) => t.text).join(""))).toEqual(splitLines(code))
    expect(lines[1]).toEqual([{ text: "two", token: "comment" }])
    expect(lines[2]?.[0]).toEqual({ text: "*/", token: "comment" })
    expect(lines[4]?.[0]).toEqual({ text: "y", token: "string" })
  })

  it("the line count matches splitLines (CRLF, empty, trailing newline)", () => {
    for (const code of ["", "\n", "a\r\n\r\nb\r\n", "a\n\n", "`\n\n`"]) {
      const lines = highlightCode(code, codeGrammars.js)
      expect(lines.map((l) => l.map((t) => t.text).join(""))).toEqual(splitLines(code))
    }
  })

  it("an unterminated comment or string ends the input or the line, not the scan", () => {
    expect(of("a /* never closed\nb", "js", "comment")).toEqual(["/* never closed\nb"])
    expect(of('"open\nb', "js", "string")).toEqual(['"open'])
  })

  it("5,000 lines of mixed code complete with every line", () => {
    const chunk = [
      "const a = `t ${b / 2} ${'{'}` // c",
      "/* x */ if (a < b) return /re[/]/g.test(s)",
      'export const C = () => <div className="x">it\'s {a}</div>',
      '"unterminated',
      "/* open",
    ]
    const code = Array.from({ length: 5000 }, (_, i) => chunk[i % 4]).join("\n")
    const lines = highlightCode(code, codeGrammars.tsx)
    expect(lines).toHaveLength(5000)
    expect(lines.reduce((n, l) => n + l.length, 0)).toBeGreaterThan(5000 * 5)
    const open = `${code}\n${chunk[4]}\n${"x / y ".repeat(20_000)}`
    expect(highlightCode(open, codeGrammars.tsx)).toHaveLength(5002)
  })
})

describe("grammars", () => {
  it("names resolve in any case; unknown is undefined (plain)", () => {
    expect(resolveGrammar("TSX")).toBe(codeGrammars.tsx)
    expect(resolveGrammar("shell")).toBe(codeGrammars.bash)
    expect(resolveGrammar("cobol")).toBeUndefined()
    expect(resolveGrammar("constructor")).toBeUndefined()
    expect(resolveGrammar(undefined)).toBeUndefined()
  })

  it("a consumer grammar: states, push/pop, a token function, non-sticky patterns", () => {
    const ini: CodeGrammar = {
      states: {
        root: [
          { match: /;[^\n]*/g, token: "comment" },
          { match: /\[/, token: "punctuation", push: "section" },
          { match: /[\w.]+(?==)/, token: "property" },
          { match: /=/, token: "operator" },
          { match: /[^\n;]+/, token: (t) => (/^\d+$/.test(t) ? "number" : "string") },
        ],
        section: [
          { match: /\]/, token: "punctuation", pop: true },
          { match: /[^\]\n]+/, token: "type" },
        ],
      },
    }
    expect(tokenize("[s]\nk=1 ; c\nv=x", ini)).toEqual([
      { text: "[", token: "punctuation" },
      { text: "s", token: "type" },
      { text: "]", token: "punctuation" },
      { text: "\n" },
      { text: "k", token: "property" },
      { text: "=", token: "operator" },
      { text: "1 ", token: "string" },
      { text: "; c", token: "comment" },
      { text: "\n" },
      { text: "v", token: "property" },
      { text: "=", token: "operator" },
      { text: "x", token: "string" },
    ])
  })
})
