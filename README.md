# homebridge-delonghi-coffee

Homebridge V2 platform for De'Longhi Coffee Link machines, including PrimaDonna Soul.

## Safety-first V2

This plugin can automatically resolve a machine's **IP address** from a configured discovery endpoint or a saved IP. It deliberately does **not** treat an IP address as proof that a local command protocol is safe to use. It never sends raw LAN commands. Commands and telemetry go through an explicitly configured Coffee Link/Ayla-compatible bridge (`cloudBridgeUrl`).

That distinction matters: PrimaDonna Soul's LAN mode uses a device-specific authenticated, encrypted protocol and requires cloud-issued LAN credentials. Discovery alone must not enable control.

## Install

```sh
npm install -g homebridge-delonghi-coffee
```

Add the platform in Homebridge UI, or use:

```json
{
  "platform": "DeLonghiCoffee",
  "name": "Kitchen Coffee",
  "cloudBridgeUrl": "https://your-bridge.example/api/",
  "cloudBridgeToken": "replace-with-a-secret",
  "enableLanDiscovery": true,
  "discoveryUrl": "https://your-bridge.example/api/discovery"
}
```

## Bridge contract

The bridge is the cloud integration boundary. It must provide:

* `GET /status` → `{ "online": true, "power": false, "waterLevel": 80, "beansLevel": 60, "groundsFull": false, "filterNeedsChange": false, "recipes": ["espresso"] }`
* `POST /command` body → `{ "command": "start" | "stop", "recipe"?: "espresso" }`
* optional `GET /discovery` → `{ "ip": "192.168.1.42" }`

All endpoints receive `Authorization: Bearer <cloudBridgeToken>` when configured. Use HTTPS. The plugin exposes a HomeKit switch plus water and beans percentage sensors. Recipe selection and richer maintenance sensors are intentionally bridge-driven until their individual property mappings are verified against the machine.

## Development

```sh
npm install
npm test
```

## Compatibility and limitations

Coffee Link devices use Ayla-backed services, but firmware and model property mappings differ. This project does not impersonate the Coffee Link app or retain its login credentials. A direct LAN transport should only be added after a confirmed protocol test on the target model, including key exchange and encrypted command validation.

This is an independent project and is not affiliated with De'Longhi, Ayla Networks, Apple, or Homebridge.
