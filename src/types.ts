export interface PlatformConfig {
  name?: string;
  pollIntervalSeconds?: number;
  cloudBridgeUrl?: string;
  cloudBridgeToken?: string;
  lanIp?: string;
  enableLanDiscovery?: boolean;
  discoveryUrl?: string;
  allowUnverifiedLanControl?: boolean;
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
  source: "cloud-bridge" | "unavailable";
}

export interface CoffeeTransport {
  getStatus(): Promise<CoffeeStatus>;
  command(command: "start" | "stop", recipe?: string): Promise<void>;
}
