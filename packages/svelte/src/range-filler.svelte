<script lang="ts">
import { rangeFillerProps } from "@rind-ui/core"
import { attrs, normalizeProps } from "./normalize-props"
</script>

<!-- NVDA's progressbar-name quirk: a filler gives the bar content to name it from. -->
<span {...attrs(normalizeProps(rangeFillerProps))}>{rangeFillerProps.children}</span>
