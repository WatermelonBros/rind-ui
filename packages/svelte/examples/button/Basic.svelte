<script lang="ts">
import { Button } from "@rind-ui/svelte"

let pending = $state(false)
let count = $state(0)

function save() {
  pending = true
  setTimeout(() => {
    pending = false
  }, 1500)
}
</script>

<div class="row">
  <Button onPress={() => count++}>Pressed {count}×</Button>
  <Button {pending} onPress={save}>{pending ? "Saving…" : "Save"}</Button>
  <Button disabled>Disabled</Button>
</div>
