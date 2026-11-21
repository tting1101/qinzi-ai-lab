"use strict";
const { handleRequest, sendJson } = require("../server");

module.exports = async function cloudHandler(request, response) {
  // A deployment must never write account files into an ephemeral filesystem.
  if (process.env.DATA_BACKEND !== "supabase" || !process.env.APP_ORIGIN?.startsWith("https://")) {
    return sendJson(response, 503, { error: "账号服务尚未配置完成。" });
  }
  return handleRequest(request, response);
};
