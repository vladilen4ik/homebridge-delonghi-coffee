import { isIP } from "node:net";

export interface DiscoveryOptions { knownIp?: string; discoveryUrl?: string; token?: string; }

/** Resolves a machine IP without probing or issuing LAN commands. */
export async function discoverIp(options: DiscoveryOptions): Promise<string | undefined> {
  if (options.knownIp && isIP(options.knownIp)) return options.knownIp;
  if (!options.discoveryUrl) return undefined;
  const response = await fetch(options.discoveryUrl, { headers: options.token ? { Authorization: `Bearer ${options.token}` } : {}, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Discovery endpoint returned ${response.status}`);
  const value = await response.json() as { ip?: unknown };
  return typeof value.ip === "string" && isIP(value.ip) ? value.ip : undefined;
}
