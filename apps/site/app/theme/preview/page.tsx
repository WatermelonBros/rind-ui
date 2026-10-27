import type { Metadata } from "next"
import { PreviewApp } from "@/components/theme/preview-app"

export const metadata: Metadata = { title: "Theme preview", robots: { index: false } }

/** @rind-ui/theme alone on one settings screen: the docs' theme page frames it. */
export default function Page() {
  return <PreviewApp />
}
