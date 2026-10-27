<script lang="ts">
import Impl from "./citation-part.svelte"
import type { CitationPartProps } from "./types"

const partProps: CitationPartProps = $props()
</script>

<Impl kind="sourceLink" {...partProps} />
