"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
const { cloudConfiguration, StoreError } = require("./account-store");

function loadLocalCloud(root = path.join(__dirname, "..")) {
  let env;
  try { env = parseEnv(fs.readFileSync(path.join(root, ".env.local"), "utf8")); }
  catch { throw new StoreError("LOCAL_CLOUD_CONFIG_MISSING"); }
  if (env.DATA_BACKEND !== "supabase") throw new StoreError("LOCAL_CLOUD_CONFIG_INVALID");
  cloudConfiguration(env);
  // Deliberately do not merge or fall back to inherited process environment.
  return { DATA_BACKEND: "supabase", SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY };
}
module.exports = { loadLocalCloud };
