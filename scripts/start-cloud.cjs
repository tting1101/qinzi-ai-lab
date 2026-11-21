"use strict";
const http = require("node:http");
const { loadLocalCloud } = require("../lib/local-cloud-config");
const { SupabaseStore } = require("../lib/account-store");
const { handleRequest } = require("../server");

try {
  const store = new SupabaseStore(loadLocalCloud());
  const server = http.createServer((request, response) => handleRequest(request, response, { store, origin: "http://127.0.0.1:3000" }));
  server.on("error", () => {
    console.error("启动失败：请先在原 PowerShell 中按 Ctrl+C 停止旧服务，再运行本命令。");
    process.exitCode = 1;
  });
  server.listen(3000, "127.0.0.1", () => console.log("云端数据测试模式：http://127.0.0.1:3000/（不会读取或修改原 data/ 账号文件）"));
} catch {
  console.error("云端配置不可用。请先配置并运行 node scripts/check-cloud.cjs。");
  process.exitCode = 1;
}
