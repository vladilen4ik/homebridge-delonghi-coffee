export interface PlatformConfig {
  name?: string;
  machineModel?: "ECAM610.75";
  pollIntervalSeconds?: number;
  cloudBridgeUrl?: string;
  cloudBridgeToken?: string;
  cloudEmail?: string;
  cloudPassword?: string;
  cloudDeviceDsn?: string;
  lanIp?: string;
  enableLanDiscovery?: boolean;
  discoveryUrl?: string;
  allowUnverifiedLanControl?: boolean;
  lanKey?: string;
  advertisedIp?: string;
  localPort?: number;
  commandPayloads?: Record<string, Record<string, unknown>>;
}

export interface CoffeeStatus {
  online: boolean;
  power?: boolean;
  brewing?: boolean;
  waterLevel?: number;
  beansLevel?: number;
  groundsFull?: boolean;
  filterNeedsChange?: boolean;
  activeRecipe?: string;
  recipes?: string[];
  source: "cloud-bridge" | "local-wifi" | "unavailable";
}

export interface CoffeeTransport {
  getStatus(): Promise<CoffeeStatus>;
  command(command: "start" | "stop", recipe?: string): Promise<void>;
}
