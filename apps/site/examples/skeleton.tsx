"use client"

import { Button, Skeleton } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { skeleton: { loading: "Card", loaded: "Loaded" } }

function CardBody({ loading }: { readonly loading: boolean }) {
  return (
    <Skeleton.Root loading={loading}>
      <Skeleton.Status />
      <Skeleton.Content className="stack">
        <div className="row">
          <Skeleton.Item data-shape="circle">
            <span aria-hidden="true">AL</span>
          </Skeleton.Item>
          <Skeleton.Item>Ada Lovelace</Skeleton.Item>
        </div>
        <Skeleton.Item>
          The analytical engine weaves algebraic patterns just as the Jacquard loom weaves flowers
          and leaves.
        </Skeleton.Item>
      </Skeleton.Content>
    </Skeleton.Root>
  )
}

export function Card() {
  return <CardBody loading />
}

export function Loaded() {
  return <CardBody loading={false} />
}

export function TextLines() {
  return (
    <Skeleton.Root>
      <Skeleton.Status>Loading the article</Skeleton.Status>
      <Skeleton.Content render={<p />}>
        <Skeleton.Item>
          Stale text from the last visit keeps its size while the new version loads, one shape per
          line.
        </Skeleton.Item>
      </Skeleton.Content>
    </Skeleton.Root>
  )
}

export function List() {
  return (
    <Skeleton.Root>
      <Skeleton.Status>Loading comments</Skeleton.Status>
      <Skeleton.Content render={<ul className="stack" />}>
        {[1, 2, 3].map((n) => (
          <li key={n}>
            <Skeleton.Item />
          </li>
        ))}
      </Skeleton.Content>
    </Skeleton.Root>
  )
}

export function AnnounceOnLoad() {
  const [loading, setLoading] = useState(true)
  return (
    <div className="stack">
      <Button onPress={() => setLoading((l) => !l)}>{loading ? "Finish loading" : "Reload"}</Button>
      <Skeleton.Root loading={loading} announceOnLoad="3 comments loaded">
        <Skeleton.Status />
        <Skeleton.Content render={<ul className="stack" />}>
          {["Great write-up.", "Thanks, this helped.", "Shipping it today."].map((text) => (
            <li key={text}>
              <Skeleton.Item>{text}</Skeleton.Item>
            </li>
          ))}
        </Skeleton.Content>
      </Skeleton.Root>
    </div>
  )
}

export function NoAnimation() {
  return (
    <Skeleton.Root animate={false}>
      <Skeleton.Status />
      <Skeleton.Content className="stack">
        <Skeleton.Item />
        <Skeleton.Item />
      </Skeleton.Content>
    </Skeleton.Root>
  )
}

export const variants: Variants = {
  Card: {
    title: "Card",
    description: "One loading area: Content is busy, Items are hidden, Status says Loading.",
  },
  Loaded: { title: "Loaded", description: "`loading={false}`: everything is exposed as rendered." },
  TextLines: {
    title: "Text lines",
    description: "An Item over stale text keeps its size and draws one shape per line.",
  },
  List: { title: "List", description: "`render={<ul />}` puts `aria-busy` on the list itself." },
  AnnounceOnLoad: {
    title: "Announce on load",
    description: "`announceOnLoad` makes one polite announcement when loading finishes.",
  },
  NoAnimation: { title: "No animation", description: "`animate={false}`: no shimmer." },
}
