// Stylesheet imports, declared here so `tsc` passes without Next's generated next-env.d.ts.
declare module "*.module.css" {
  const classes: { readonly [className: string]: string }
  export default classes
}
declare module "*.css"
