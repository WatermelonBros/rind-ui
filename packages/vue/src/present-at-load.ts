/**
 * Whether the instance's part is already in the document when its component is set up: true
 * while hydrating server markup (a part present at load), false for a client mount. Public
 * attributes only (`data-scope`, `data-part`, `data-instance`), so it holds in every framework.
 */
export function presentAtLoad(scope: string, part: string, instance: string): boolean {
  if (typeof document === "undefined") return true
  return (
    document.querySelector(
      `[data-scope="${scope}"][data-part="${part}"][data-instance="${CSS.escape(instance)}"]`,
    ) !== null
  )
}
