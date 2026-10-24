<script lang="ts">
import { type FormErrors, platforms } from "@rind-ui/core"
import { currentRun, installAnnouncementLog } from "@rind-ui/testing"
import { untrack } from "svelte"
import { Field, Form, RindProvider, TextField } from "../../src/index"

interface Spec {
  readonly name: string
  readonly value: string
  readonly required?: boolean
  readonly async?: boolean
}
const {
  cfg,
  errors,
  onReset,
}: {
  cfg: {
    fields: readonly Spec[]
    mode?: "submit" | "blur" | "change"
    behavior?: "native" | "aria"
    late?: boolean
  }
  errors?: FormErrors
  onReset?: () => void
} = $props()
let actions: { validate(name?: string): void } | undefined = $state()
let count = $state(0)
let ready = $state(untrack(() => !cfg.late))
$effect(() => {
  ready = true
})
const first = $derived(cfg.fields[0]?.name)
const log = installAnnouncementLog()
const announcer = { announce: (a: never) => log.push(a), prepare: () => () => {}, cancel: () => {} }
</script>

<RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }} {announcer}>
  <Form.Root
    bind:this={actions}
    aria-label="Sign up"
    {...cfg.mode ? { validationMode: cfg.mode } : {}}
    {...cfg.behavior ? { validationBehavior: cfg.behavior } : {}}
    {...errors ? { errors } : {}}
    onFormSubmit={() => count++}
    onreset={() => onReset?.()}
  >
    {#each cfg.fields as f (f.name)}
      {#if !(f.name === first && !ready)}
        <Field.Root
          name={f.name}
          required={f.required === true}
          {...f.async ? { validate: (v: unknown) => (v ? new Promise<null>(() => {}) : null) } : {}}
        >
          <Field.Label>{f.name}</Field.Label>
          <TextField.Root defaultValue={f.value}><TextField.Input /></TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
      {/if}
    {/each}
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
    <button type="button" onclick={() => actions?.validate()}>Validate</button>
    <p>Submissions: {count}</p>
  </Form.Root>
</RindProvider>
