"use client"

// Harness-only Tags Inputs for the driver tests: a mirrored parent and a form.
import { TagsInput } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "../types"

function Parts() {
  return (
    <>
      <TagsInput.Label>Tags</TagsInput.Label>
      <TagsInput.Control>
        <TagsInput.Chips />
        <TagsInput.Input />
        <TagsInput.ClearTrigger aria-label="Clear all" />
      </TagsInput.Control>
    </>
  )
}

/** The parent mirrors the tags and the draft, so the machine and the parent must agree. */
export function Mirrored() {
  const [tags, setTags] = useState<readonly string[]>([])
  const [text, setText] = useState("")
  return (
    <div className="stack">
      <TagsInput.Root
        value={tags}
        onValueChange={setTags}
        inputValue={text}
        onInputValueChange={setText}
      >
        <Parts />
      </TagsInput.Root>
      <output data-testid="mirror">{`${tags.join("|")}#${text}`}</output>
    </div>
  )
}

export function InForm() {
  const [data, setData] = useState("")
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setData(new FormData(e.currentTarget).getAll("tags").join("|"))
      }}
    >
      <TagsInput.Root name="tags" defaultValue={["rome"]}>
        <Parts />
      </TagsInput.Root>
      <button type="submit">Submit</button>
      <output data-testid="submitted">{data}</output>
    </form>
  )
}

export const variants: Variants = {
  Mirrored: { title: "Mirrored", hidden: true },
  InForm: { title: "In a form", hidden: true },
}
