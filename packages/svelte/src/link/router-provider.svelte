<script lang="ts">
import RindProvider from "../rind-provider.svelte"
import type { RouterProviderProps } from "./types"

const { navigate, href, children }: RouterProviderProps = $props()
const environment = $derived({ router: href ? { navigate, href } : { navigate } })
</script>

<!-- Client routing for every link part below; the innermost provider wins. -->
<RindProvider {environment}>{@render children?.()}</RindProvider>
