"use client"

import { exampleComponent, examples } from "@/examples"

export function LabAll() {
  return (
    <div style={{ padding: 120 }}>
      {Object.entries(examples).flatMap(([slug, mod]) =>
        Object.keys(mod.variants).map((name) => {
          const Example = exampleComponent(mod, name)
          return (
            <section key={`${slug}-${name}`} data-skin="crisp">
              <h2>
                {slug} · {name}
              </h2>
              {Example && <Example />}
            </section>
          )
        }),
      )}
    </div>
  )
}
