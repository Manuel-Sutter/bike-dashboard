export const SESSION_COOKIE_NAME = "bike_dashboard_session";

// Web Crypto (not Node's `crypto` module) so this works unchanged whether
// middleware runs on the Edge or Node.js runtime.
export async function computeSessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`bike-dashboard:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
