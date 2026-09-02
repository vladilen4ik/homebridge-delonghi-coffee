import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { CoffeeStatus, CoffeeTransport } from "./types";

const hmac = (key: string, data: Buffer): Buffer => createHmac("sha256", key).update(data).digest();
const derive = (key: string, data: Buffer): Buffer => hmac(key, Buffer.concat([hmac(key, data), data]));
const b64 = (value: Buffer): string => value.toString("base64");

export interface LocalWifiOptions { machineIp: string; lanKey: string; advertisedIp: string; port: number; commandPayloads?: Record<string, Record<string, unknown>>; onStatus?: (status: CoffeeStatus) => void; }

interface Session { appSign: Buffer; appKey: Buffer; appIv: Buffer; devKey: Buffer; devIv: Buffer; }

/** De'Longhi/Ayla local listener. It uses the LAN protocol only after a cloud-issued key is provided. */
export class LocalWifiTransport implements CoffeeTransport {
  private server = createServer((req, res) => void this.route(req, res));
  private session?: Session;
  private sequence = 0;
  private queue: Record<string, unknown>[] = [];
  private status: CoffeeStatus = { online: false, source: "local-wifi" };
  constructor(private readonly options: LocalWifiOptions) {}
  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => { this.server.once("error", reject); this.server.listen(this.options.port, this.options.advertisedIp, () => { this.server.off("error", reject); resolve(); }); });
    const response = await fetch(`http://${this.options.machineIp}/local_reg.json`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ local_reg: { ip: this.options.advertisedIp, notify: 1, port: this.options.port, uri: "/local_lan" } }), signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Machine local registration returned ${response.status}`);
  }
  async stop(): Promise<void> { await new Promise<void>((resolve, reject) => this.server.close(error => error ? reject(error) : resolve())); }
  async getStatus(): Promise<CoffeeStatus> { return this.status; }
  async command(command: "start" | "stop", recipe?: string): Promise<void> {
    const key = recipe ? `${command}:${recipe}` : command;
    const payload = this.options.commandPayloads?.[key] || this.options.commandPayloads?.[command];
    if (!payload) throw new Error(`No verified local payload configured for ${key}. V3 refuses to invent device commands.`);
    this.queue.push(payload);
  }
  private async route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readJson(req).catch(() => ({}));
    if (req.url === "/local_lan/key_exchange.json" && req.method === "POST") return this.handshake(body, res);
    if (req.url === "/local_lan/commands.json" && req.method === "GET") return this.poll(res);
    if (req.url === "/local_lan/property/datapoint.json" && req.method === "POST") return this.property(body, res);
    res.writeHead(404).end();
  }
  private handshake(body: any, res: ServerResponse): void {
    const r1 = body?.key_exchange?.random_1; const t1 = body?.key_exchange?.time_1;
    if (typeof r1 !== "string" || !Number.isFinite(t1)) return void res.writeHead(400).end();
    const r2 = randomBytes(12).toString("base64").replace(/=+$/, ""); const t2 = Math.floor(Date.now() / 1000);
    const app = Buffer.from(`${r1}${r2}${t1}${t2}`); const dev = Buffer.from(`${r2}${r1}${t2}${t1}`);
    this.session = { appSign: derive(this.options.lanKey, Buffer.concat([app, Buffer.from([0x30])])), appKey: derive(this.options.lanKey, Buffer.concat([app, Buffer.from([0x31])])), appIv: derive(this.options.lanKey, Buffer.concat([app, Buffer.from([0x32])])).subarray(0, 16), devKey: derive(this.options.lanKey, Buffer.concat([dev, Buffer.from([0x31])])), devIv: derive(this.options.lanKey, Buffer.concat([dev, Buffer.from([0x32])])).subarray(0, 16) };
    this.setStatus({ ...this.status, online: true, source: "local-wifi" });
    res.writeHead(202, { "content-type": "application/json" }).end(JSON.stringify({ random_2: r2, time_2: t2 }));
  }
  private poll(res: ServerResponse): void {
    if (!this.session) return void json(res, { enc: "", sign: "", seq: this.sequence });
    const data = this.queue.shift() || {}; const payload = JSON.stringify({ seq_no: String(++this.sequence), data });
    const encrypted = encrypt(payload, this.session.appKey, this.session.appIv); this.session.appIv = Buffer.from(encrypted, "base64").subarray(-16);
    json(res, { enc: encrypted, sign: b64(createHmac("sha256", this.session.appSign).update(payload).digest()), seq: this.sequence });
  }
  private property(body: any, res: ServerResponse): void {
    try { if (!this.session || typeof body?.enc !== "string") throw new Error("no session"); const raw = decrypt(body.enc, this.session.devKey, this.session.devIv); this.session.devIv = Buffer.from(body.enc, "base64").subarray(-16); this.setStatus({ ...this.status, ...extractStatus(JSON.parse(raw)), online: true, source: "local-wifi" }); } catch { /* device retries on server errors; acknowledge malformed telemetry */ }
    json(res, {});
  }
  private setStatus(value: CoffeeStatus): void { this.status = value; this.options.onStatus?.(value); }
}
function encrypt(text: string, key: Buffer, iv: Buffer): string { const input = Buffer.from(text); const padded = Buffer.concat([input, Buffer.alloc(16 - input.length % 16)]); const cipher = createCipheriv("aes-256-cbc", key, iv); return b64(Buffer.concat([cipher.update(padded), cipher.final()])); }
function decrypt(encoded: string, key: Buffer, iv: Buffer): string { const decipher = createDecipheriv("aes-256-cbc", key, iv); return Buffer.concat([decipher.update(Buffer.from(encoded, "base64")), decipher.final()]).toString().replace(/\0+$/, ""); }
function extractStatus(value: any): Partial<CoffeeStatus> { const flat = JSON.stringify(value).toLowerCase(); return { brewing: flat.includes("brewing"), groundsFull: flat.includes("grounds_full") || flat.includes("groundsfull"), filterNeedsChange: flat.includes("filter") && flat.includes("change") }; }
function readJson(req: IncomingMessage): Promise<any> { return new Promise((resolve, reject) => { let text = ""; req.on("data", part => text += part); req.on("end", () => resolve(text ? JSON.parse(text) : {})); req.on("error", reject); }); }
function json(res: ServerResponse, value: unknown): void { res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(value)); }
