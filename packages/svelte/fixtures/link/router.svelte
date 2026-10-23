<script lang="ts">
import { Link, RouterProvider } from "../../src/index"

const { navigate, onclick }: { navigate: (href: unknown) => void; onclick: () => void } = $props()
</script>

<RouterProvider {navigate}>
  <Link href="/docs">Docs</Link>
  <Link href="/off" disabled {onclick}>Off</Link>
</RouterProvider>
