import { Children, isValidElement, type ReactNode } from "react"

export interface DeclaredItem {
  readonly value: string
  readonly disabled: boolean
}

/**
 * The items of a composite declared in its JSX children (any depth, in render order),
 * before they register: the server render's tab stop needs them. Items rendered by a
 * wrapper component of the consumer's are not seen (the stop then follows registration).
 */
export function declaredItems(children: ReactNode, item: unknown): readonly DeclaredItem[] {
  const out: DeclaredItem[] = []
  const walk = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return
      const props = child.props as { value?: unknown; disabled?: unknown; children?: ReactNode }
      if (child.type === item && typeof props.value === "string") {
        out.push({ value: props.value, disabled: props.disabled === true })
      }
      if (props.children !== undefined) walk(props.children)
    })
  }
  walk(children)
  return out
}

/** The server tab stop: the first enabled declared item that is selected, else the first enabled. */
export function serverStop(
  items: readonly DeclaredItem[],
  selected: readonly string[],
): string | null {
  const enabled = items.filter((i) => !i.disabled)
  return (enabled.find((i) => selected.includes(i.value)) ?? enabled[0])?.value ?? null
}
