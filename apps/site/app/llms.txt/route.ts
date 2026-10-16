import { readFileSync } from "node:fs"
import { join } from "node:path"

export const dynamic = "force-static"

const raw = "https://raw.githubusercontent.com/WatermelonBros/rind-ui/main/docs"

/**
 * /llms.txt: the repo's generated llms.txt, served where assistants look for it. Its links are
 * repo-relative, so they point at the raw markdown on GitHub here.
 */
export function GET() {
  const text = readFileSync(join(process.cwd(), "../../llms.txt"), "utf8")
    .replace(/\]\(docs\/([^)]+)\)/g, `](${raw}/$1)`)
    .replace(/\]\(\.\.\/(components|guides)\/([^)]+)\)/g, `](${raw}/$1/$2)`)
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } })
}
