<script lang="ts">
import { nextHeadingLevel } from "@rind-ui/core"
import { headingLevel } from "./context"
import type { HeadingLevelProps } from "./types"

const { level, children }: HeadingLevelProps = $props()
const parent = headingLevel.maybe()
const next = $derived(nextHeadingLevel(parent?.(), level))
headingLevel.set(() => next)
</script>

{@render children?.()}
