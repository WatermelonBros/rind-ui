// The rind-ui MCP server's logic: JSON-RPC 2.0 messages in, responses out (the Model Context
// Protocol's stdio transport carries one message per line; index.ts does the I/O). The docs come
// from the site's generated markdown (llms.txt and one page per component), so the server never
// ships a copy that could go stale and has no dependency.

/** Where the docs live; a test passes its own. */
export const SITE = "https://rind.watermelon-studio.it"

/** Fetches a text resource, or throws; injected so tests run offline. */
export type Fetcher = (url: string) => Promise<string>

export const fetchText: Fetcher = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.text()
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null

export type Response =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string } }

const PROTOCOL = "2025-06-18"

const TOOLS = [
  {
    name: "list_components",
    description:
      "List every rind-ui component (headless React: behaviour, keyboard, ARIA and state, no styles) with a one-line summary. Call this first to pick the right component.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_component",
    description:
      "The full docs of one rind-ui component as markdown: when to use it, parts, props, data-* attributes, keyboard support, accessibility notes and its test driver. Use before writing code with it.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: 'Component name or slug, e.g. "Combobox" or "date-field".',
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "search_docs",
    description:
      'Search rind-ui\'s components and guides by keyword (e.g. "autocomplete", "focus trap", "chat"). Returns the matching pages with their summaries.',
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_started",
    description:
      "How to install rind-ui, compose parts, style data-* attributes and verify the result with the test drivers.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const

/** One line of llms.txt's index: `- [Title](url): summary`, with the section it is in. */
interface Entry {
  readonly title: string
  readonly url: string
  readonly summary: string
  readonly section: string
}

export function parseIndex(llms: string): Entry[] {
  const entries: Entry[] = []
  let section = ""
  for (const line of llms.split("\n")) {
    const heading = /^## (.+)$/.exec(line)
    if (heading?.[1]) {
      section = heading[1]
      continue
    }
    const m = /^- \[([^\]]+)\]\(([^)]+)\): (.*)$/.exec(line)
    if (m?.[1] && m[2]) entries.push({ title: m[1], url: m[2], summary: m[3] ?? "", section })
  }
  return entries
}

/** "Date Field", "date field", "DateField" and "date-field" all name date-field. */
export const slugOf = (name: string): string =>
  name
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const text = (body: string) => ({ content: [{ type: "text", text: body }] })

async function callTool(name: string, args: Record<string, unknown>, get: Fetcher, site: string) {
  const index = async () => parseIndex(await get(`${site}/llms.txt`))
  switch (name) {
    case "list_components": {
      const list = (await index()).filter((e) => e.section === "Components")
      return text(list.map((e) => `- ${e.title}: ${e.summary}`).join("\n"))
    }
    case "get_component": {
      const wanted = typeof args["name"] === "string" ? args["name"] : ""
      const slug = slugOf(wanted)
      if (!slug) throw new Error("get_component needs a name")
      try {
        return text(await get(`${site}/docs/${slug}.md`))
      } catch {
        // not a page: offer the closest names instead of a bare error
        const near = (await index())
          .filter((e) => e.section === "Components")
          .filter((e) => slugOf(e.title).includes(slug) || slug.includes(slugOf(e.title)))
          .map((e) => e.title)
        return text(
          `No rind-ui component named "${wanted}".${near.length ? ` Did you mean: ${near.join(", ")}?` : " Call list_components to see them all."}`,
        )
      }
    }
    case "search_docs": {
      const words = String(args["query"] ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
      if (!words.length) throw new Error("search_docs needs a query")
      const hits = (await index()).filter((e) => {
        const hay = `${e.title} ${e.summary}`.toLowerCase()
        return words.every((w) => hay.includes(w))
      })
      return text(
        hits.length
          ? hits.map((e) => `- ${e.title} (${e.section}): ${e.summary}`).join("\n")
          : `Nothing matches "${words.join(" ")}". Call list_components.`,
      )
    }
    case "get_started": {
      const llms = await get(`${site}/llms.txt`)
      // everything before the index: the summary and the quick start
      const end = llms.indexOf("\n## Guides")
      const intro = end > 0 ? llms.slice(0, end) : llms
      return text(`${intro.trim()}\n\nFull docs: ${site}/llms-full.txt`)
    }
    default:
      throw new UnknownTool(name)
  }
}

class UnknownTool extends Error {}

/** Answers one message; null for a notification (no id), which gets no response. */
export async function handle(
  message: unknown,
  get: Fetcher = fetchText,
  site: string = SITE,
): Promise<Response | null> {
  const req = isObject(message) ? message : null
  const rawId = req?.["id"]
  const id = typeof rawId === "string" || typeof rawId === "number" ? rawId : null
  const notification = !req || rawId === undefined
  const fail = (code: number, msg: string): Response => ({
    jsonrpc: "2.0",
    id,
    error: { code, message: msg },
  })
  const method = req?.["method"]
  if (!req) return notification ? null : fail(-32600, "Invalid request")
  if (req["jsonrpc"] !== "2.0" || typeof method !== "string") {
    return notification ? null : fail(-32600, "Invalid request")
  }
  const ok = (result: unknown): Response | null =>
    notification ? null : { jsonrpc: "2.0", id, result }
  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: "rind-ui", version: "0.1.0" },
        instructions:
          "rind-ui is a headless React component library. Before writing UI with it, call list_components (or search_docs), then get_component for each component you use; verify the result with the component's test driver from @rind-ui/testing.",
      })
    case "notifications/initialized":
    case "notifications/cancelled":
      return null
    case "ping":
      return ok({})
    case "tools/list":
      return ok({ tools: TOOLS })
    case "tools/call": {
      const params = isObject(req["params"]) ? req["params"] : {}
      const name = typeof params["name"] === "string" ? params["name"] : ""
      const args = isObject(params["arguments"]) ? params["arguments"] : {}
      try {
        return ok(await callTool(name, args, get, site))
      } catch (e) {
        if (e instanceof UnknownTool) return fail(-32602, `Unknown tool: ${name}`)
        // a tool that fails reports it as a result, so the agent can read it and recover
        return ok({
          ...text(`Error: ${e instanceof Error ? e.message : String(e)}`),
          isError: true,
        })
      }
    }
    default:
      return fail(-32601, `Method not found: ${method}`)
  }
}
