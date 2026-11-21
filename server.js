"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } = require("node:crypto");
const { createStore } = require("./lib/account-store");

const host = "127.0.0.1";
const port = 3000;
const address = `http://${host}:${port}`;
const dataDir = path.join(__dirname, "data");
const sessionSeconds = 24 * 60 * 60;
const cookieName = "qinzi_local_session";
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/script.js", ["script.js", "text/javascript; charset=utf-8"]],
  ["/topics.js", ["topics.js", "text/javascript; charset=utf-8"]],
  ["/images/weekend.webp", ["images/weekend.webp", "image/webp"]],
  ["/images/inventor.webp", ["images/inventor.webp", "image/webp"]],
  ["/images/monster.webp", ["images/monster.webp", "image/webp"]],
]);

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}

let accountStore;
function getStore() {
  if (!accountStore) accountStore = createStore({ directory: dataDir });
  return accountStore;
}

function passwordHash(password, salt) {
  return scryptSync(password, Buffer.from(salt, "hex"), 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieTokenHash(request) {
  const cookie = (request.headers.cookie || "").split(";")
    .map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(token || "") ? hashToken(token) : null;
}

function setCookie(response, token, maxAge, secure) {
  response.setHeader("Set-Cookie", `${cookieName}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}

async function readJson(request) {
  // Vercel parses JSON bodies before passing a request to this shared handler.
  try {
    if (request.body !== undefined) {
      if (Buffer.byteLength(JSON.stringify(request.body)) > 4096) return null;
      return typeof request.body === "object" && !Array.isArray(request.body) ? request.body : null;
    }
  } catch { return null; }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

async function handle(request, response, options = {}) {
  const configuredOrigin = options.origin || process.env.APP_ORIGIN || (process.env.VERCEL ? null : address);
  if (!configuredOrigin) return sendJson(response, 503, { error: "账号服务尚未配置完成。" });
  const origin = new URL(configuredOrigin);
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    return sendJson(response, 503, { error: "账号服务尚未配置完成。" });
  }
  if (process.env.VERCEL && origin.protocol !== "https:") return sendJson(response, 503, { error: "账号服务尚未配置完成。" });
  const secure = origin.protocol === "https:";
  const hostname = request.headers.host;
  const localAlias = !secure && origin.origin === address && hostname === `localhost:${port}`;
  if (hostname !== origin.host && !localAlias) {
    return sendJson(response, 403, { error: "请从本站地址操作。" });
  }
  const route = request.url.split("?", 1)[0];
  if (request.method === "GET" || request.method === "HEAD") {
    const asset = assets.get(route);
    if (asset) {
      const [file, type] = asset;
      const content = fs.readFileSync(path.join(__dirname, file));
      response.writeHead(200, { "Content-Type": type, "Content-Length": content.length });
      return response.end(request.method === "HEAD" ? undefined : content);
    }
  }

  if (request.method === "GET" && route === "/api/me") {
    const store = options.store || getStore();
    const tokenHash = cookieTokenHash(request);
    const session = tokenHash && await store.getSession(tokenHash);
    const user = session && session.expiresAt > Date.now() && await store.getUser(session.userId);
    return sendJson(response, 200, { username: user?.username ?? null });
  }

  if (request.method !== "POST" || !["/api/register", "/api/login", "/api/logout"].includes(route)) {
    return sendJson(response, 404, { error: "找不到这个页面。" });
  }
  if (request.headers.origin !== origin.origin && !(localAlias && request.headers.origin === `http://localhost:${port}`)) {
    return sendJson(response, 403, { error: "请从本站页面操作。" });
  }
  const store = options.store || getStore();

  if (route === "/api/logout") {
    const tokenHash = cookieTokenHash(request);
    if (tokenHash) await store.deleteSession(tokenHash);
    setCookie(response, "", 0, secure);
    return sendJson(response, 200, { username: null });
  }

  if (request.headers["content-type"]?.split(";", 1)[0] !== "application/json") {
    return sendJson(response, 415, { error: "请从本站表单提交。" });
  }
  const credentials = await readJson(request);
  const username = typeof credentials?.username === "string" ? credentials.username.trim() : "";
  const password = credentials?.password;
  if (!/^[\p{L}\p{N}_-]{1,24}$/u.test(username)) {
    return sendJson(response, 400, { error: "用户名需为 1–24 个字，可用字母、数字、下划线和短横线。" });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return sendJson(response, 400, { error: "密码长度需为 8–128 个字符。" });
  }

  const user = await store.findUser(username);
  if (route === "/api/register") {
    if (user) return sendJson(response, 409, { error: "这个用户名已注册。" });
    const salt = randomBytes(16).toString("hex");
    try {
      await store.createUser({ id: randomUUID(), username, salt, passwordHash: passwordHash(password, salt).toString("hex") });
    } catch (error) {
      if (error.code === "DUPLICATE_USER") return sendJson(response, 409, { error: "这个用户名已注册。" });
      throw error;
    }
    return sendJson(response, 201, { message: "注册成功，请登录。" });
  }

  const candidateHash = passwordHash(password, user?.salt ?? "0".repeat(32));
  if (!user || !timingSafeEqual(candidateHash, Buffer.from(user.passwordHash, "hex"))) {
    return sendJson(response, 401, { error: "用户名或密码不正确。" });
  }
  const now = Date.now();
  const oldTokenHash = cookieTokenHash(request);
  const token = randomBytes(32).toString("hex");
  await store.createSession({ tokenHash: hashToken(token), expiresAt: now + sessionSeconds * 1000, userId: user.id }, oldTokenHash);
  setCookie(response, token, sessionSeconds, secure);
  return sendJson(response, 200, { username: user.username });
}

async function handleRequest(request, response, options) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  try { await handle(request, response, options); }
  catch {
    if (!response.headersSent) sendJson(response, 503, { error: "账号服务暂时不可用，请稍后重试。" });
    else response.destroy();
  }
}

// Importing this file from a Vercel Function or a test never starts a server.
if (require.main === module) {
  try { getStore(); }
  catch {
    console.error("账号数据或云端配置无法初始化。");
    process.exitCode = 1;
  }
  if (!process.exitCode) {
    const server = http.createServer(handleRequest);
    server.on("error", error => {
      console.error(`本地服务器启动失败 (${error.code || "UNKNOWN"})`);
      process.exitCode = 1;
    });
    server.listen(port, host, () => console.log(`亲子 AI 创造资料库 ${address}`));
  }
}
module.exports = { handleRequest, passwordHash, hashToken, sendJson };
