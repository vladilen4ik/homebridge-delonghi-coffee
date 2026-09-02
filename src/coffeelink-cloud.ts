import { createHmac } from "node:crypto";

const GIGYA = "https://accounts.eu1.gigya.com";
const ADS = "https://ads-eu.aylanetworks.com";
const USER = "https://user-field-eu.aylanetworks.com";
export interface CloudMachine { dsn: string; lanIp: string; lanKey: string; model: string; }
export interface CloudCredentials { apiKey: string; clientId: string; clientSecret: string; }
const form = (data: Record<string, string>) => new URLSearchParams(data).toString();
const json = async (response: Response): Promise<any> => { const body = await response.json(); if (!response.ok) throw new Error(`Coffee Link cloud returned ${response.status}`); return body; };

/** Signs in directly to Coffee Link, then retrieves the cloud-issued LAN key. */
export async function discoverCoffeeLinkMachine(email: string, password: string, credentials: CloudCredentials, wantedDsn?: string): Promise<CloudMachine> {
  const login = await json(await fetch(`${GIGYA}/accounts.login`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ apiKey: credentials.apiKey, loginID: email, password, format: "json", targetEnv: "mobile" }), signal: AbortSignal.timeout(15000) }));
  if (login.errorCode !== 0) throw new Error(`Coffee Link sign-in failed: ${login.errorMessage || login.errorCode}`);
  const timestamp = String(Math.floor(Date.now() / 1000)); const nonce = `${timestamp}_1`;
  const params: Record<string, string> = { apiKey: credentials.apiKey, oauth_token: login.sessionInfo.sessionToken, format: "json", timestamp, nonce };
  const ordered = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  const base = `POST&${encodeURIComponent(`${GIGYA}/accounts.getJWT`)}&${encodeURIComponent(ordered)}`;
  params.sig = createHmac("sha1", Buffer.from(login.sessionInfo.sessionSecret, "base64")).update(base).digest("base64");
  const jwt = await json(await fetch(`${GIGYA}/accounts.getJWT`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form(params), signal: AbortSignal.timeout(15000) }));
  if (jwt.errorCode !== 0) throw new Error(`Coffee Link token exchange failed: ${jwt.errorMessage || jwt.errorCode}`);
  const token = await json(await fetch(`${USER}/api/v1/token_sign_in`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ token: jwt.id_token, app_id: credentials.clientId, app_secret: credentials.clientSecret }), signal: AbortSignal.timeout(15000) }));
  if (!token.access_token) throw new Error("Coffee Link sign-in did not return an access token");
  const headers = { Authorization: `auth_token ${token.access_token}` };
  const devices = await json(await fetch(`${ADS}/apiv1/devices.json`, { headers, signal: AbortSignal.timeout(15000) }));
  const device = devices.map((entry: any) => entry.device || entry).find((entry: any) => wantedDsn ? entry.dsn === wantedDsn : String(entry.oem_model || "").startsWith("DL-millcore"));
  if (!device) throw new Error(wantedDsn ? "Configured Coffee Link DSN was not found" : "No PrimaDonna Soul / millcore machine found; enter cloudDeviceDsn");
  const details = await json(await fetch(`${ADS}/apiv1/dsns/${device.dsn}.json`, { headers, signal: AbortSignal.timeout(15000) }));
  const info = details.device || details; if (!info.lan_enabled || !info.lan_ip) throw new Error("This Coffee Link device has no enabled LAN configuration");
  let config: any;
  const lan = await fetch(`${ADS}/apiv1/devices/${device.dsn}/lan.json`, { headers, signal: AbortSignal.timeout(15000) });
  config = lan.ok ? await lan.json() : await json(await fetch(`${ADS}/apiv1/devices/${device.dsn}/connection_config.json`, { headers, signal: AbortSignal.timeout(15000) }));
  const lanKey = config?.lanip?.lanip_key || config?.local_key;
  if (typeof lanKey !== "string" || !lanKey) throw new Error("Coffee Link did not return a LAN key");
  return { dsn: device.dsn, lanIp: info.lan_ip, lanKey, model: info.model || device.model || "ECAM610.75" };
}
