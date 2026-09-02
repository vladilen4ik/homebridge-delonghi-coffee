import assert from "node:assert/strict";
import test from "node:test";

test("registers the DeLonghi Homebridge platform", () => {
  const plugin = require("../index") as (api: { registerPlatform: (...args: unknown[]) => void }) => void;
  let call: unknown[] = [];
  plugin({ registerPlatform: (...args: unknown[]) => { call = args; } });
  assert.equal(call[0], "homebridge-delonghi-coffee");
  assert.equal(call[1], "DeLonghiCoffee");
  assert.equal(typeof call[2], "function");
});
