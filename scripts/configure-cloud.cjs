"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { cloudConfiguration } = require("../lib/account-store");
const target = path.join(__dirname, "..", ".env.local");
const projectURL = "https://mklnxuvejrjiqbxadhus.supabase.co";

function readHidden() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error("INTERACTIVE_TERMINAL_REQUIRED"));
    let secret = "";
    process.stdout.write("粘贴 Supabase Secret key（输入不显示），然后按回车：");
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    function finish(error) {
      process.stdin.removeListener("data", receive);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) { secret = ""; reject(error); } else resolve(secret);
    }
    function receive(chunk) {
      for (const char of chunk) {
        if (char === "\u0003") return finish(new Error("CANCELLED"));
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f" || char === "\b") secret = secret.slice(0, -1);
        else secret += char;
      }
    }
    process.stdin.on("data", receive);
  });
}

(async () => {
  if (fs.existsSync(target)) throw new Error("CONFIG_EXISTS_NOT_OVERWRITTEN");
  let key = await readHidden();
  cloudConfiguration({ SUPABASE_URL: projectURL, SUPABASE_SECRET_KEY: key });
  fs.writeFileSync(target, `DATA_BACKEND=supabase\nSUPABASE_URL=${projectURL}\nSUPABASE_SECRET_KEY=${key}\n`, { flag: "wx", mode: 0o600 });
  key = "";
  console.log("配置已保存到项目的 .env.local，未修改 Windows 环境变量。请勿分享或上传这个文件。");
  console.log("请告诉 Codex：已配置。后续连接检查由 Codex 执行，不用发送密钥。 ");
})().catch(error => {
  const messages = {
    CONFIG_EXISTS_NOT_OVERWRITTEN: "配置文件已存在，本次没有覆盖。",
    INTERACTIVE_TERMINAL_REQUIRED: "请在你自己的 PowerShell 窗口运行本命令。",
    CANCELLED: "已取消，没有保存凭据。",
    CLOUD_CONFIG_INVALID: "密钥格式不正确或含空白。请复制 Secret key，不要复制 Publishable key；没有保存。",
    CLOUD_CONFIG_MISSING: "没有输入密钥，没有保存。",
  };
  console.error(messages[error.code || error.message] || "配置未完成。未输出任何密钥，请保留原配置。 ");
  process.exitCode = 1;
});
