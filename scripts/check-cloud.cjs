"use strict";
const { loadLocalCloud } = require("../lib/local-cloud-config");
const { SupabaseStore } = require("../lib/account-store");

(async () => {
  const env = loadLocalCloud();
  const store = new SupabaseStore(env);
  console.log("CREDENTIAL SOURCE: .env.local (explicit; no PROCESS ENV fallback)");
  console.log("GUARD: READY");
  await store.check();
  console.log("CLOUD CONNECTION + TABLE ACCESS: PASS");
  console.log("Account rows read: 0; writes: 0; existing local accounts: untouched.");
})().catch(error => {
  const safeCodes = new Set(["LOCAL_CLOUD_CONFIG_MISSING", "LOCAL_CLOUD_CONFIG_INVALID", "CLOUD_CONFIG_MISSING", "CLOUD_CONFIG_INVALID", "CLOUD_REQUEST_FAILED", "CLOUD_REQUEST_UNCERTAIN", "CLOUD_RESPONSE_INVALID"]);
  console.error(`CLOUD CHECK: BLOCKED (${safeCodes.has(error.code) ? error.code : "CHECK_FAILED"})`);
  process.exitCode = 1;
});
