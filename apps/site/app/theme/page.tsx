import type { Metadata } from "next"
import NextLink from "next/link"
import { brands } from "@/lib/theme-brands"

export const metadata: Metadata = { title: "Theme pages" }

export default function ThemeIndex() {
  return (
    <>
      <h1>@rind-ui/theme</h1>
      <p>
        The theme package's own pages. Add <code>?brand=</code> ({brands.join(", ")}) and{" "}
        <code>?scheme=light|dark</code> to any of them.
      </p>
      <ul>
        <li>
          <NextLink href="/theme/tokens/">Tokens</NextLink>
        </li>
        <li>
          <NextLink href="/theme/contrast/">Contrast report</NextLink>
        </li>
        <li>
          <NextLink href="/theme/showcase/">Showcase</NextLink>
        </li>
        <li>
          <NextLink href="/docs/">Back to the docs</NextLink>
        </li>
      </ul>
    </>
  )
}
