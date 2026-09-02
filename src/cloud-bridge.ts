import { CoffeeStatus, CoffeeTransport } from "./types";

export class CloudBridgeTransport implements CoffeeTransport {
  constructor(private readonly baseUrl: string, private readonly token?: string) {}
  private headers(): Record<string, string> { return { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) }; }
  async getStatus(): Promise<CoffeeStatus> {
    const response = await fetch(new URL("status", this.baseUrl), { headers: this.headers(), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Bridge status returned ${response.status}`);
    const body = await response.json() as Omit<CoffeeStatus, "source">;
    return { ...body, online: Boolean(body.online), source: "cloud-bridge" };
  }
  async command(command: "start" | "stop", recipe?: string): Promise<void> {
    const response = await fetch(new URL("command", this.baseUrl), { method: "POST", headers: this.headers(), body: JSON.stringify({ command, recipe }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Bridge command returned ${response.status}`);
  }
}
