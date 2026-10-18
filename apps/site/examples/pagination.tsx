"use client"

import { Button, Pagination, type PaginationRootProps } from "@rind-ui/react"
import { useId, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { pagination: { idle: "Basic" } }

/** First, Previous, the visible range, Next, Last. */
function Pager(props: PaginationRootProps & { readonly ends?: boolean }) {
  const { ends = false, ...root } = props
  return (
    <Pagination.Root {...root}>
      {(state) => (
        <Pagination.List>
          {ends && (
            <Pagination.Item type="trigger">
              <Pagination.First />
            </Pagination.Item>
          )}
          <Pagination.Item type="trigger">
            <Pagination.Previous />
          </Pagination.Item>
          {state.pages.map((e) =>
            e.type === "page" ? (
              <Pagination.Item key={e.key}>
                <Pagination.Page value={e.value} />
              </Pagination.Item>
            ) : (
              <Pagination.Item key={e.key} type="ellipsis">
                <Pagination.Ellipsis position={e.position} />
              </Pagination.Item>
            ),
          )}
          <Pagination.Item type="trigger">
            <Pagination.Next />
          </Pagination.Item>
          {ends && (
            <Pagination.Item type="trigger">
              <Pagination.Last />
            </Pagination.Item>
          )}
        </Pagination.List>
      )}
    </Pagination.Root>
  )
}

export function Basic() {
  return <Pager totalPages={10} />
}

export function ManyPages() {
  return <Pager totalPages={100} defaultPage={50} ends aria-label="Results pages" />
}

export function Range() {
  return (
    <div className="stack">
      <Pager totalPages={20} defaultPage={10} siblingCount={0} aria-label="No siblings" />
      <Pager totalPages={20} defaultPage={10} siblingCount={2} aria-label="Two siblings" />
      <Pager totalPages={20} defaultPage={10} boundaryCount={2} aria-label="Two at each end" />
    </div>
  )
}

export function Links() {
  return <Pager totalPages={8} getPageHref={(page) => `#page-${page}`} aria-label="Posts" />
}

export function PageSize() {
  const [size, setSize] = useState(10)
  const id = useId()
  return (
    <div className="stack">
      <Pagination.Root
        count={95}
        pageSize={size}
        onPageSizeChange={setSize}
        aria-label="Orders"
        render={(props, state) => (
          <nav {...props}>
            <p className="note">
              Items {state.range.start}–{state.range.end} of 95
            </p>
            <Pagination.List>
              <Pagination.Item type="trigger">
                <Pagination.Previous />
              </Pagination.Item>
              {state.pages.map((e) =>
                e.type === "page" ? (
                  <Pagination.Item key={e.key}>
                    <Pagination.Page value={e.value} />
                  </Pagination.Item>
                ) : (
                  <Pagination.Item key={e.key} type="ellipsis">
                    <Pagination.Ellipsis position={e.position} />
                  </Pagination.Item>
                ),
              )}
              <Pagination.Item type="trigger">
                <Pagination.Next />
              </Pagination.Item>
            </Pagination.List>
            <label htmlFor={id}>Per page </label>
            <select
              id={id}
              value={size}
              onChange={(e) => state.setPageSize(Number(e.currentTarget.value))}
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </nav>
        )}
      />
    </div>
  )
}

export function OwnText() {
  return (
    <Pagination.Root totalPages={5} defaultPage={2} aria-label="Blog">
      <Pagination.List>
        <Pagination.Item type="trigger">
          <Pagination.Previous>Newer posts</Pagination.Previous>
        </Pagination.Item>
        <Pagination.Item type="trigger">
          <Pagination.Next>Older posts</Pagination.Next>
        </Pagination.Item>
      </Pagination.List>
    </Pagination.Root>
  )
}

export function Loading() {
  const [loading, setLoading] = useState(false)
  return (
    <div className="stack">
      <Pager
        totalPages={10}
        disabled={loading}
        aria-label="Search results"
        onPageChange={() => setLoading(true)}
      />
      <Button onPress={() => setLoading(false)}>Finish loading</Button>
    </div>
  )
}

export function RightToLeft() {
  return (
    <div dir="rtl" lang="ar">
      <Pager
        totalPages={10}
        defaultPage={3}
        aria-label="الصفحات"
        messages={{
          page: (n) => `الصفحة ${n}`,
          previous: "الصفحة السابقة",
          next: "الصفحة التالية",
        }}
      />
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: 'A `nav` named Pagination; the current page has `aria-current="page"`.',
  },
  ManyPages: {
    title: "Many pages",
    description: "Seven slots whatever the page, so the controls never shift; First and Last.",
  },
  Range: {
    title: "Range",
    description: "`siblingCount` and `boundaryCount`; an ellipsis never hides a single page.",
  },
  Links: {
    title: "Links",
    description: "`getPageHref` renders links: ⌘/Ctrl-click opens a page in a new tab.",
  },
  PageSize: {
    title: "Page size",
    description: "A page-size control calls `setPageSize`; the first item stays visible.",
  },
  OwnText: {
    title: "Triggers with text",
    description: "A trigger with its own text keeps it as its name.",
  },
  Loading: {
    title: "Disabled while loading",
    description: "`disabled` keeps focus where it is and drops every hover.",
  },
  RightToLeft: {
    title: "Right to left",
    description: "Chevrons mirror; names come from `messages`.",
  },
}
