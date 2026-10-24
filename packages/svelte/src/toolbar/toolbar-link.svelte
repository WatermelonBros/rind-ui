<script lang="ts">
import Link from "../link/link.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useControl } from "./host.svelte"
import type { ToolbarLinkProps } from "./types"

const { id, disabled = false, focusableWhenDisabled, ...rest }: ToolbarLinkProps = $props()
const uid = $props.id()
const c = useControl("Link", uid, () => ({
  id: id ?? undefined,
  disabled,
  focusable: focusableWhenDisabled,
}))
const merged = $derived(
  mergeProps(
    {
      ...normalizeProps({ ...c.roving(), ...c.host.api.part("link", c.id()) }),
      // Space activates a link once without scrolling the page (Enter stays native).
      onkeydown: (e: KeyboardEvent) => {
        if (e.key !== " " || e.defaultPrevented || e.target !== e.currentTarget) return
        e.preventDefault()
        if (!e.repeat) (e.currentTarget as HTMLElement).click()
      },
      ...c.el.props,
    },
    rest,
  ),
)
</script>

<Link {...merged} id={c.id()} disabled={c.disabled()} focusableWhenDisabled={c.keepsFocus()} />
