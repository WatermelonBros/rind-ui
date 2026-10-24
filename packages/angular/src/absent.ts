import type { PartProps } from "@rind-ui/core"

/**
 * The props of a part React renders nothing for in this state (Skeleton's Status once loaded,
 * an Image's Fallback before it is due, a dismissed Alert). The element is the consumer's and
 * stays, hidden by both `hidden` and an inline `display: none` (an author `display` rule beats
 * `hidden` alone), with its scope and instance and no `data-part`: drivers and skins find a
 * part by scope and part, and this one is not rendered.
 */
export const absentProps = (scope: string, instance: string): PartProps => ({
  "data-scope": scope,
  "data-instance": instance,
  hidden: true,
  style: { display: "none" },
})
