import type { Metadata } from "next"
import { Showcase } from "@/components/theme/showcase"

export const metadata: Metadata = { title: "Theme showcase" }

export default function Page() {
  return <Showcase />
}
