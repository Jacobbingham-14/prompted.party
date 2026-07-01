/**
 * Only accept https:// URLs from known image hosts we control or trust,
 * so a compromised/misbehaving upstream can't slip a javascript: or
 * data: URL into an <img src> that renders across every player screen.
 *
 * Add hosts here as needed; leave the list conservative by default.
 */
const ALLOWED_HOSTS = new Set<string>([
  "replicate.delivery",
  "pbxt.replicate.delivery",
  "storage.googleapis.com",
  "supabase.co",
  "supabase.in",
]);

export function isTrustedImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    // Allow exact host match or any subdomain of an allowed host.
    for (const host of ALLOWED_HOSTS) {
      if (u.hostname === host || u.hostname.endsWith("." + host)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
