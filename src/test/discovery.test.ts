import assert from "node:assert/strict";
import test from "node:test";
import { discoverIp } from "../discovery";

test("uses a valid configured address without network access", async () => assert.equal(await discoverIp({ knownIp: "192.168.1.23" }), "192.168.1.23"));
test("rejects malformed configured addresses", async () => assert.equal(await discoverIp({ knownIp: "not-an-ip" }), undefined));
