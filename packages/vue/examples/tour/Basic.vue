<script setup lang="ts">
import { TextField, Toolbar, Tour, type TourStepDef } from "@rind-ui/vue"
import { useId } from "vue"

const base = useId()
const ids = { search: `${base}-search`, toolbar: `${base}-toolbar` }
const byId = (id: string) => () => document.getElementById(id)
const nav = [
  { action: "prev" as const, label: "Back" },
  { action: "next" as const, label: "Next" },
]
// The last step ends the tour instead of offering a next one.
const last = [
  { action: "prev" as const, label: "Back" },
  { action: "dismiss" as const, label: "Done" },
]
const steps: TourStepDef[] = [
  {
    id: "welcome",
    title: "Welcome",
    description: "Three quick steps through the editor.",
    actions: [{ action: "skip", label: "Skip" }, ...nav],
  },
  {
    id: "search",
    title: "Search",
    description: "Find any file by name.",
    target: byId(ids.search),
    actions: nav,
  },
  {
    id: "toolbar",
    title: "Formatting",
    description: "Bold and italic live here.",
    target: byId(ids.toolbar),
    side: "top",
    actions: last,
  },
]
</script>

<template>
  <div class="stack">
    <!-- The trigger first: a card placed below its target never covers it. -->
    <Tour.Root :steps="steps">
      <Tour.Trigger>Take the tour</Tour.Trigger>
      <Tour.Portal>
        <Tour.Backdrop />
        <Tour.Spotlight />
        <Tour.Positioner>
          <Tour.Content>
            <Tour.Arrow />
            <Tour.Title />
            <Tour.Description />
            <div class="row">
              <Tour.ProgressText />
              <Tour.Actions v-slot="actions">
                <Tour.ActionTrigger
                  v-for="a in actions"
                  :key="String(a.label ?? a.action)"
                  :action="a"
                />
              </Tour.Actions>
              <Tour.CloseTrigger>Close</Tour.CloseTrigger>
            </div>
          </Tour.Content>
        </Tour.Positioner>
      </Tour.Portal>
    </Tour.Root>
    <div class="row" style="align-items: last baseline">
      <!-- The tour's targets are plain wrappers: an id on a rind part would replace its own. -->
      <div :id="ids.search">
        <TextField.Root class="row">
          <TextField.Label>Search</TextField.Label>
          <TextField.Input />
        </TextField.Root>
      </div>
      <div :id="ids.toolbar">
        <Toolbar.Root class="row" aria-label="Formatting">
          <Toolbar.Button>Bold</Toolbar.Button>
          <Toolbar.Button>Italic</Toolbar.Button>
        </Toolbar.Root>
      </div>
    </div>
  </div>
</template>
