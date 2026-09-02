import assert from "node:assert/strict";
import test from "node:test";
import { LocalWifiTransport } from "../local-wifi";

test("local Wi-Fi transport refuses invented brew commands", async () => {
  const transport = new LocalWifiTransport({ machineIp: "127.0.0.1", lanKey: "test-key", advertisedIp: "127.0.0.1", port: 0 });
  await assert.rejects(transport.command("start"), /No verified local payload/);
});
