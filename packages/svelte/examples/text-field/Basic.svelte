<script lang="ts">
import { TextField } from "@rind-ui/svelte"
</script>

<TextField.Root name="handle" required>
  <TextField.Label>Handle</TextField.Label>
  <TextField.Input placeholder="@you" maxlength={20} />
  <TextField.Description>Up to 20 characters.</TextField.Description>
  <TextField.ErrorMessage />
</TextField.Root>
