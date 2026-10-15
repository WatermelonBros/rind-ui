"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"

/**
 * Shows, live, the data-* attributes of the first [data-part] element inside it: how the guides
 * make state visible. A site helper, not part of any example's code.
 */
export function AttributeReadout({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [attrs, setAttrs] = useState<readonly string[]>([])
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>("[data-part]")
    if (!el) return
    const read = () =>
      setAttrs(
        [...el.attributes]
          .map((a) => a.name)
          .filter(
            (n) =>
              n.startsWith("data-") &&
              !["data-scope", "data-part", "data-instance", "data-rind-pressable"].includes(n),
          ),
      )
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, { attributes: true })
    return () => mo.disconnect()
  }, [])
  return (
    <div className="stack readout-host" ref={box}>
      {children}
      <p className="readout" aria-live="off">
        {attrs.length ? (
          attrs.map((a) => <code key={a}>{a}</code>)
        ) : (
          <code>no state attributes</code>
        )}
      </p>
    </div>
  )
}
