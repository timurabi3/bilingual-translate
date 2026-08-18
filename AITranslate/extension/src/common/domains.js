// Domain matching for the auto-translate list. Exact host or any subdomain:
// "taobao.com" matches "taobao.com" and "world.taobao.com", but never
// "nottaobao.com" or "taobao.com.evil.io".
export function domainMatches(hostname, domain) {
  const h = String(hostname || "").toLowerCase();
  const d = String(domain || "").toLowerCase().replace(/^\.+/, "").trim();
  if (!d) return false;
  return h === d || h.endsWith("." + d);
}

export function hostnameMatches(hostname, domains) {
  return Array.isArray(domains) && domains.some((d) => domainMatches(hostname, d));
}
