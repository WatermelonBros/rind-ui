// Markup compared across frameworks: the same component rendered by @rind-ui/react,
// @rind-ui/vue and @rind-ui/svelte must produce the same elements and attributes. Each
// framework spells the incidentals differently (comment markers, attribute order, style
// whitespace, the shape of generated ids), so both sides are reduced to one canonical form.

/** Attributes whose values may contain generated ids (a toolbar control's key is its id, a radio group's default name holds its instance). */
const ID_REFS =
  /^(id|for|name|data-key|aria-(labelledby|describedby|controls|owns|activedescendant|details|errormessage|flowto))$/

/**
 * A canonical rendering of `html` (or of `node`'s children): comments and whitespace-only text
 * dropped, adjacent texts joined, attributes sorted, styles normalised by the browser's CSS
 * serialiser; every element id becomes `@0`, `@1`… (in document order) wherever an id or an ARIA
 * relation names it, and every instance id (`data-instance`) `#0`, `#1`… inside the others.
 * Needs a DOM (jsdom or a browser).
 */
export function canonicalHtml(html: string | Node): string {
  const root =
    typeof html === "string"
      ? Object.assign(document.createElement("template"), { innerHTML: html }).content
      : html
  const instances: string[] = []
  const seen = (el: Element) => {
    const id = el.getAttribute("data-instance")
    if (id && !instances.includes(id)) instances.push(id)
    for (const child of Array.from(el.children)) seen(child)
  }
  for (const child of Array.from(root.childNodes)) if (child instanceof Element) seen(child)
  // Every element id, in document order: a framework's generated ids need not contain the
  // instance id (an Accordion item's own `useId`), so each one is a token of its own.
  const elementIds: string[] = []
  const collect = (el: Element) => {
    if (el.id && !elementIds.includes(el.id)) elementIds.push(el.id)
    for (const child of Array.from(el.children)) collect(child)
  }
  for (const child of Array.from(root.childNodes)) if (child instanceof Element) collect(child)
  // Longest first, so an id that contains another is replaced whole.
  const order = [...instances].sort((a, b) => b.length - a.length)
  const inInstance = (value: string) =>
    order.reduce((v, id) => v.split(id).join(`#${instances.indexOf(id)}`), value)
  const ids = (value: string) =>
    value
      .split(" ")
      .map((token) =>
        elementIds.includes(token) ? `@${elementIds.indexOf(token)}` : inInstance(token),
      )
      .join(" ")

  // CSS anchor names hold an escaped id (`--rind-anchor-popover-_5f_r_5f_0_5f_-trigger`): each
  // becomes `--rind-anchor-0`, `--rind-anchor-1`… in order of appearance.
  const anchorNames: string[] = []
  const anchors = (value: string) =>
    value.replace(/--rind-anchor-[^\s;,)]+/g, (name) => {
      if (!anchorNames.includes(name)) anchorNames.push(name)
      return `--rind-anchor-${anchorNames.indexOf(name)}`
    })
  const declaration = (p: string, value: string) =>
    // The positioner names its anchor's id (a part id, holding the instance).
    p === "--rind-anchor-id" ? inInstance(value) : anchors(value)

  const out: string[] = []
  const walk = (node: Node, depth: number) => {
    const pad = "  ".repeat(depth)
    if (!(node instanceof Element)) return
    const attrs = Array.from(node.attributes)
      // Hover follows wherever the pointer rests (a previous test's last move), not the markup.
      .filter(({ name }) => name !== "data-hover" && name !== "data-hovering")
      .map(({ name, value }) => {
        if (name === "style") {
          const style = (node as HTMLElement).style
          const decls = Array.from({ length: style.length }, (_, i) => style.item(i))
            .sort()
            .map((p) => `${p}: ${declaration(p, style.getPropertyValue(p))}`)
          return `style="${decls.join("; ")}"`
        }
        const v =
          name === "data-instance" ? inInstance(value) : ID_REFS.test(name) ? ids(value) : value
        return `${name}="${v}"`
      })
      .sort()
    out.push(`${pad}<${node.tagName.toLowerCase()}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`)
    children(node, depth + 1)
  }
  // Adjacent text nodes are one text (frameworks split "+{count}" differently).
  const children = (parent: Node, depth: number) => {
    let text = ""
    const flush = () => {
      const t = text.replace(/\s+/g, " ").trim()
      if (t) out.push(`${"  ".repeat(depth)}"${t}"`)
      text = ""
    }
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === 3) text += child.textContent ?? ""
      else if (child.nodeType === 1) {
        flush()
        walk(child, depth)
      }
    }
    flush()
  }
  children(root, 0)
  return out.join("\n")
}
