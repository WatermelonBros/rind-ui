import { harnessIndex } from "@/lib/harness"

export const dynamic = "force-static"

/** Every harness example with its slug, name, title, states and URL per skin. */
export function GET() {
  return Response.json(harnessIndex())
}
