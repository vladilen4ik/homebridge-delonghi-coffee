import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, Service } from "homebridge";
import { CloudBridgeTransport } from "./cloud-bridge";
import { discoverCoffeeLinkMachine } from "./coffeelink-cloud";
import { discoverIp } from "./discovery";
import { LocalWifiTransport } from "./local-wifi";
import { CoffeeStatus, CoffeeTransport, PlatformConfig } from "./types";

const PLUGIN = "homebridge-delonghi-coffee";
const PLATFORM = "DeLonghiCoffee";

export = (api: API) => api.registerPlatform(PLUGIN, PLATFORM, DeLonghiCoffeePlatform);

class DeLonghiCoffeePlatform implements DynamicPlatformPlugin {
  private accessory?: PlatformAccessory;
  private readonly Service: typeof Service;
  private transport?: CoffeeTransport;
  private localTransport?: LocalWifiTransport;
  private status: CoffeeStatus = { online: false, source: "unavailable" };
  constructor(private readonly log: Logger, private readonly config: PlatformConfig, private readonly api: API) {
    this.Service = api.hap.Service;
    api.on("didFinishLaunching", () => this.launch());
  }
  configureAccessory(accessory: PlatformAccessory): void { this.accessory = accessory; }
  private async launch(): Promise<void> {
    const name = this.config.name || "De'Longhi Coffee";
    if (!this.accessory) {
      this.accessory = new this.api.platformAccessory(name, this.api.hap.uuid.generate(`${PLUGIN}:${name}`));
      this.api.registerPlatformAccessories(PLUGIN, PLATFORM, [this.accessory]);
    }
    this.configureServices(this.accessory);
    let machineIp: string | undefined;
    let lanKey = this.config.lanKey;
    if (this.config.cloudEmail && this.config.cloudPassword && this.config.cloudApiKey && this.config.cloudClientId && this.config.cloudClientSecret) {
      try { const machine = await discoverCoffeeLinkMachine(this.config.cloudEmail, this.config.cloudPassword, { apiKey: this.config.cloudApiKey, clientId: this.config.cloudClientId, clientSecret: this.config.cloudClientSecret }, this.config.cloudDeviceDsn); machineIp = machine.lanIp; lanKey = machine.lanKey; this.log.info(`Coffee Link found ${machine.model} (${machine.dsn}) and supplied the local LAN configuration.`); }
      catch (error) { this.log.warn(`Coffee Link cloud connection failed: ${(error as Error).message}`); }
    }
    if (this.config.enableLanDiscovery !== false) {
      try { machineIp = await discoverIp({ knownIp: this.config.lanIp, discoveryUrl: this.config.discoveryUrl, token: this.config.cloudBridgeToken }); if (machineIp) this.log.info(`Machine LAN address discovered: ${machineIp}.`); }
      catch (error) { this.log.warn(`LAN discovery failed: ${(error as Error).message}`); }
    }
    if (machineIp && lanKey && this.config.advertisedIp) {
      this.localTransport = new LocalWifiTransport({ machineIp, lanKey, advertisedIp: this.config.advertisedIp, port: this.config.localPort || 10280, commandPayloads: this.config.commandPayloads, onStatus: status => { this.status = status; this.accessory?.getService(this.Service.Switch)?.updateCharacteristic(this.api.hap.Characteristic.On, status.power ?? false); } });
      try { await this.localTransport.start(); this.transport = this.localTransport; this.log.info("Local Wi-Fi listener registered. Commands require configured verified payloads."); await this.refresh(); return; }
      catch (error) { this.log.warn(`Local Wi-Fi mode unavailable; using cloud fallback when configured: ${(error as Error).message}`); await this.localTransport.stop().catch(() => undefined); this.localTransport = undefined; }
    }
    if (!this.config.cloudBridgeUrl) { this.log.warn("No Coffee Link/Ayla bridge configured; exposing a safe unavailable accessory."); return; }
    this.transport = new CloudBridgeTransport(this.config.cloudBridgeUrl, this.config.cloudBridgeToken);
    await this.refresh();
    setInterval(() => void this.refresh(), Math.max(15, this.config.pollIntervalSeconds || 60) * 1000).unref();
  }
  private configureServices(accessory: PlatformAccessory): void {
    const power = accessory.getService(this.Service.Switch) || accessory.addService(this.Service.Switch, accessory.displayName);
    power.getCharacteristic(this.api.hap.Characteristic.On).onGet(() => this.status.power ?? false).onSet(async value => this.command(value ? "start" : "stop"));
    const online = accessory.getService(this.Service.AccessoryInformation)!;
    online.setCharacteristic(this.api.hap.Characteristic.Manufacturer, "De'Longhi").setCharacteristic(this.api.hap.Characteristic.Model, this.config.machineModel || "ECAM610.75 PrimaDonna Soul");
    const water = accessory.getService("Water") || accessory.addService(this.Service.HumiditySensor, "Water");
    water.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity).onGet(() => this.status.waterLevel ?? 0);
    const beans = accessory.getService("Beans") || accessory.addService(this.Service.HumiditySensor, "Beans");
    beans.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity).onGet(() => this.status.beansLevel ?? 0);
  }
  private async refresh(): Promise<void> {
    if (!this.transport || !this.accessory) return;
    try { this.status = await this.transport.getStatus(); this.accessory.getService(this.Service.Switch)?.updateCharacteristic(this.api.hap.Characteristic.On, this.status.power ?? false); }
    catch (error) { this.status = { online: false, source: "unavailable" }; this.log.warn(`Coffee status unavailable: ${(error as Error).message}`); }
  }
  private async command(command: "start" | "stop"): Promise<void> { if (!this.transport) throw new Error("Configure cloudBridgeUrl before sending commands."); await this.transport.command(command); await this.refresh(); }
}
