<script lang="ts">
import Item from "../color-swatch-picker/color-swatch-picker-item.svelte"
import type { ColorSwatchPickerItemProps } from "../color-swatch-picker/types"
import { colorPicker } from "./context"

const props: ColorSwatchPickerItemProps = $props()
colorPicker.get()
</script>

<Item {...props} />
