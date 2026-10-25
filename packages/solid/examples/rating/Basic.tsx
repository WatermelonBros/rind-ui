/** @jsxImportSource solid-js */
import { Rating } from "@rind-ui/solid"
import { For } from "solid-js"

export function Basic() {
  return (
    <Rating.Root defaultValue={3}>
      <Rating.Label>Rate this recipe</Rating.Label>
      <Rating.Control>
        <For each={[1, 2, 3, 4, 5]}>{(i) => <Rating.Item index={i} />}</For>
      </Rating.Control>
    </Rating.Root>
  )
}
