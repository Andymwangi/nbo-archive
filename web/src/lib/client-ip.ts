/*
  The visitor's address as seen by this server, forwarded to the API so its rate limits and
  audit fields apply per visitor rather than to the web server's own address.
*/
export function visitorIpFrom(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || headers.get("x-real-ip") || undefined;
}
