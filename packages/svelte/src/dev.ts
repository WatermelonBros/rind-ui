// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

/** Development build: diagnostics (warnings, checks) run only then. */
export const DEV = process.env.NODE_ENV !== "production"
