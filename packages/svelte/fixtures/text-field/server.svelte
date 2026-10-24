<script lang="ts">
import { TextField } from "../../src/index"
</script>

<TextField.Root defaultValue="pw" type="password">
  <TextField.Label>Pw</TextField.Label>
  <TextField.Input />
</TextField.Root>
<TextField.Root defaultValue="b">
  <TextField.Label>Bio</TextField.Label>
  <TextField.Textarea />
</TextField.Root>
