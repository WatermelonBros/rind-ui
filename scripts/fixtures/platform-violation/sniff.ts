// Fixture for scripts/lint-platform.test.ts: a workaround that sniffs the platform.
export const isMac = () => navigator.userAgent.includes("Mac")
export const flag = (env: { platform: { ios: boolean } }) => env.platform.ios
export const bare = (platform: { ios: boolean }) => (platform.ios ? 1 : 0)
export const destructured = (env: { platform: { ios: boolean } }) => {
  const { ios } = env.platform
  return ios
}
export const keyed = (e: { platform: Record<string, boolean> }) => e.platform["webkit"]
export const param = ({ android }: { android: boolean }) => android
// platform-convention: an allowed, explained convention
export const allowed = (p: { apple: boolean }) => p.apple
// The word ios in a comment or "a string .ios" is not a read.
export const prose = "platform.ios"
