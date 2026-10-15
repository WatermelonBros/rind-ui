// Sample brands for the toolbar and the contrast report (design D10). Built in adjust mode
// at load, so a garish accent still ships a passing theme; the report lists what moved.
import { checkTheme, defineTheme } from "@rind-ui/theme/builder"

export const sampleBrands = [
  defineTheme({ name: "sample-yellow", accent: "oklch(0.86 0.17 95)", contrast: "adjust" }),
  defineTheme({ name: "sample-white", accent: "#f5f5f0", contrast: "adjust" }),
]

/** Brand value of the `brand` global → its contrast report. Presets are checked, not built. */
export const reports = {
  calm: checkTheme({ name: "calm", extends: "calm" }),
  crisp: checkTheme({ name: "crisp", extends: "crisp" }),
  ...Object.fromEntries(sampleBrands.map((b) => [b.name, b.report])),
}

export const brands = ["calm", "crisp", ...sampleBrands.map((b) => b.name)]

/** One <style> for all sample brands (calm and crisp ship as CSS files). */
export function injectBrands(): void {
  if (typeof document === "undefined" || document.getElementById("rind-sample-brands")) return
  const style = document.createElement("style")
  style.id = "rind-sample-brands"
  style.textContent = sampleBrands.map((b) => b.css).join("\n")
  document.head.append(style)
}
