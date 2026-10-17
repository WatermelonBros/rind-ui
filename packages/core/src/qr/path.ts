// qrPath (design §1): one SVG path in module units covering exactly the dark modules, each
// maximal horizontal run of a row as one subpath, offset by the quiet zone.

export interface QrPathOptions {
  /** Light modules around the symbol, included as an offset. Default 4. */
  readonly quietZone?: number | undefined
}

export function qrPath(
  modules: readonly (readonly boolean[])[],
  { quietZone = 4 }: QrPathOptions = {},
): string {
  let d = ""
  modules.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) {
        x++
        continue
      }
      const start = x
      while (x < row.length && row[x]) x++
      const left = start + quietZone
      d += `M${left} ${y + quietZone}h${x - start}v1H${left}z`
    }
  })
  return d
}
