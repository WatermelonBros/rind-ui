import type { Metadata } from "next"
import { reports } from "@/lib/theme-brands"

const mono = { fontFamily: "var(--rind-font-mono)", fontSize: "var(--rind-text-xs)" } as const
const cell = { textAlign: "start", padding: "var(--rind-space-1) var(--rind-space-2)" } as const

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        inlineSize: 16,
        blockSize: 16,
        verticalAlign: "middle",
        background: color,
        border: "1px solid var(--rind-color-border-strong)",
      }}
    />
  )
}

function Report({ brand }: { brand: string }) {
  const report = reports[brand as keyof typeof reports]
  if (!report) return null
  return (
    <section
      id={`contrast-${brand}`}
      aria-labelledby={`h-${brand}`}
      style={{ marginBlockEnd: "var(--rind-space-8)" }}
    >
      <h2 id={`h-${brand}`}>
        {brand}: {report.ok ? "every pair passes" : "failing pairs"}
      </h2>
      <table style={{ borderCollapse: "collapse", ...mono }}>
        <caption style={{ textAlign: "start" }}>Contrast pairs of {brand}</caption>
        <thead>
          <tr>
            {["Scheme", "Foreground", "Background", "Ratio", "Required", "Pass"].map((h) => (
              <th key={h} scope="col" style={cell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.pairs.map((p) => (
            <tr key={`${p.scheme}-${p.foreground}-${p.background}`}>
              <td style={cell}>{p.scheme}</td>
              <td style={cell}>{p.foreground}</td>
              <td style={cell}>{p.background}</td>
              <td style={cell}>{p.ratio}</td>
              <td style={cell}>{p.required}</td>
              <td style={cell}>{p.pass ? "pass" : "fail"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Adjusted tokens</h3>
      {report.adjusted.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul style={mono}>
          {report.adjusted.map((a) => (
            <li key={`${a.scheme}-${a.token}`}>
              {a.scheme} {a.token}: <Swatch color={a.from} /> {a.from} to <Swatch color={a.to} />{" "}
              {a.to}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export const metadata: Metadata = { title: "Contrast report" }

/** Every checked pair of every preset and sample brand, light and dark. */
export default function ContrastReport() {
  return (
    <div>
      <h1>Contrast report</h1>
      {Object.keys(reports).map((b) => (
        <Report key={b} brand={b} />
      ))}
    </div>
  )
}
