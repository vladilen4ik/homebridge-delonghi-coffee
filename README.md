# homebridge-delonghi-coffee

Homebridge V3 platform for De'Longhi Coffee Link machines, including PrimaDonna Soul.

The current V3 profile targets **PrimaDonna Soul ECAM610.75** (the millcore Wi-Fi family).

## Direct Coffee Link connection

In the Homebridge settings, enter your Coffee Link email and password (and a DSN only if you have more than one machine). The plugin signs in from the Homebridge host, locates the ECAM610.75, and obtains its current LAN IP and cloud-issued LAN key. It uses them only in memory to start local Wi-Fi mode; they are not logged. `advertisedIp` is still required because it is the address the machine calls back.

## V3 local Wi-Fi mode

V3 uses De'Longhi's authenticated local registration and encrypted callback flow when you provide the machine IP, its cloud-issued LAN key, and the Homebridge host's LAN IP. It starts a listener (default port `10280`), registers it with the machine, handles key exchange, accepts encrypted local telemetry, and queues only command payloads that **you have verified for your exact machine/firmware**.

```json
{
  "platform": "DeLonghiCoffee",
  "lanIp": "192.168.1.42",
  "lanKey": "cloud-issued-secret",
  "advertisedIp": "192.168.1.10",
  "localPort": 10280,
  "commandPayloads": {
    "start": { "your": "verified ECAM payload" },
    "stop": { "your": "verified ECAM payload" }
  }
}
```

`commandPayloads` is intentional: recipes and command layouts vary between firmware/models. Without a verified payload, the HomeKit switch refuses the command instead of sending a speculative brew request. If the local listener cannot connect, the configured cloud bridge remains the fallback.

## Safety-first design

This plugin can automatically resolve a machine's **IP address** from a configured discovery endpoint or a saved IP. V3 local mode requires a cloud-issued LAN key and a successful encrypted handshake; an IP address alone never enables control.

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

Coffee Link devices use Ayla-backed services, but firmware and model property mappings differ. This project does not impersonate the Coffee Link app or retain its login credentials. Local telemetry is enabled only after a confirmed key exchange. Local commands are enabled only for payloads you explicitly configure for the target model.

This is an independent project and is not affiliated with De'Longhi, Ayla Networks, Apple, or Homebridge.
