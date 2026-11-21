"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

class StoreError extends Error {
  constructor(code) { super(code); this.code = code; }
}

// Keep the original local JSON representation; cloud mode never falls back here.
class FileStore {
  constructor(directory) {
    this.directory = directory;
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    for (const file of ["users.json", "sessions.json"]) {
      const target = path.join(directory, file);
      if (!fs.existsSync(target)) fs.writeFileSync(target, "[]\n", { flag: "wx", mode: 0o600 });
      if (!Array.isArray(this.read(file))) throw new StoreError("INVALID_LOCAL_DATA");
    }
  }
  read(file) { return JSON.parse(fs.readFileSync(path.join(this.directory, file), "utf8")); }
  write(file, value) {
    const target = path.join(this.directory, file);
    const temporary = `${target}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    try { fs.renameSync(temporary, target); }
    finally { if (fs.existsSync(temporary)) fs.rmSync(temporary); }
  }
  findUser(username) { return this.read("users.json").find(user => user.username.toLowerCase() === username.toLowerCase()); }
  getUser(id) { return this.read("users.json").find(user => user.id === id); }
  createUser(user) {
    const users = this.read("users.json");
    if (users.some(item => item.username.toLowerCase() === user.username.toLowerCase())) throw new StoreError("DUPLICATE_USER");
    this.write("users.json", [...users, user]);
  }
  getSession(tokenHash) { return this.read("sessions.json").find(item => item.tokenHash === tokenHash); }
  createSession(session, oldTokenHash) {
    const sessions = this.read("sessions.json").filter(item => item.expiresAt > Date.now() && item.tokenHash !== oldTokenHash);
    this.write("sessions.json", [...sessions, session]);
  }
  deleteSession(tokenHash) { this.write("sessions.json", this.read("sessions.json").filter(item => item.tokenHash !== tokenHash)); }
}

function cloudConfiguration(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new StoreError("CLOUD_CONFIG_MISSING");
  if (!/^https:\/\/[a-z0-9]{16,30}\.supabase\.co\/?$/.test(url) ||
      !/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(key) || /\s|[\x00-\x1f\x7f]/.test(key)) {
    throw new StoreError("CLOUD_CONFIG_INVALID");
  }
  return { url: url.replace(/\/$/, ""), key };
}

function fromCloudUser(row) {
  return row && { id: row.id, username: row.username, salt: row.salt, passwordHash: row.password_hash };
}

class SupabaseStore {
  constructor(env, fetchImpl = fetch) {
    const config = cloudConfiguration(env);
    this.url = config.url;
    this.key = config.key;
    this.fetchImpl = fetchImpl;
  }
  async query(table, params = {}, method = "GET", body) {
    const url = new URL(`${this.url}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    let response;
    try {
      response = await this.fetchImpl(url, {
        method,
        // New secret keys are not JWTs: use apikey, never Bearer sb_secret_… .
        headers: { apikey: this.key, "Content-Type": "application/json", Prefer: "return=minimal" },
        signal: AbortSignal.timeout(10000),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new StoreError("CLOUD_REQUEST_UNCERTAIN"); }
    if (!response.ok) {
      if (response.status === 409 && table === "website_users") throw new StoreError("DUPLICATE_USER");
      // Never log response bodies, headers, credentials, or connection exceptions.
      throw new StoreError("CLOUD_REQUEST_FAILED");
    }
    if (method !== "GET") return;
    try {
      const result = await response.json();
      if (!Array.isArray(result)) throw new Error();
      return result;
    } catch { throw new StoreError("CLOUD_RESPONSE_INVALID"); }
  }
  async findUser(username) {
    return fromCloudUser((await this.query("website_users", { username_key: `eq.${username.toLowerCase()}`, select: "id,username,salt,password_hash", limit: "1" }))[0]);
  }
  async getUser(id) {
    return fromCloudUser((await this.query("website_users", { id: `eq.${id}`, select: "id,username,salt,password_hash", limit: "1" }))[0]);
  }
  createUser(user) {
    return this.query("website_users", {}, "POST", { id: user.id, username: user.username, username_key: user.username.toLowerCase(), salt: user.salt, password_hash: user.passwordHash });
  }
  async getSession(tokenHash) {
    const row = (await this.query("website_sessions", { token_hash: `eq.${tokenHash}`, select: "token_hash,user_id,expires_at", limit: "1" }))[0];
    return row && { tokenHash: row.token_hash, userId: row.user_id, expiresAt: Number(row.expires_at) };
  }
  async createSession(session, oldTokenHash) {
    await this.query("website_sessions", {}, "POST", { token_hash: session.tokenHash, user_id: session.userId, expires_at: session.expiresAt });
    if (oldTokenHash) await this.deleteSession(oldTokenHash);
  }
  deleteSession(tokenHash) { return this.query("website_sessions", { token_hash: `eq.${tokenHash}` }, "DELETE"); }
  async check() {
    // Metadata-only access check: neither request returns any account or session row.
    await this.query("website_users", { select: "id", limit: "0" });
    await this.query("website_sessions", { select: "token_hash", limit: "0" });
  }
}

function createStore({ env = process.env, directory, fetchImpl } = {}) {
  const mode = env.DATA_BACKEND || (env.VERCEL ? "supabase" : "file");
  if (mode === "supabase") return new SupabaseStore(env, fetchImpl);
  if (mode !== "file" || env.VERCEL) throw new StoreError("UNSUPPORTED_DATA_BACKEND");
  return new FileStore(directory);
}

module.exports = { FileStore, SupabaseStore, StoreError, cloudConfiguration, createStore };
