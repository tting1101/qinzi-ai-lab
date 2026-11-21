# 账号云端连接与部署

本机云端账号由 Owner 于 2026-11-20 手动验收通过。2026-11-21 原 Vercel 项目 Production 已部署 Ready，公网 HTTP 与浏览器账号验收通过，未导入旧账号。

## 沿用的规则

- 原 `data/users.json`、`data/sessions.json` 保留，不自动导入或清空。
- 每用户随机盐、scrypt 参数和旧密码哈希格式保持兼容。
- 每次登录新发 token，只保存 tokenHash、userId 和过期时间；退出删除对应会话。
- Cookie 为 HttpOnly、SameSite=Strict，HTTPS 时追加 Secure，路径仍为 `/api`。
- 服务密钥只在本机私有配置或 Vercel 服务端环境变量内，不放前端、源码、聊天或报告。

## 文件与运行模式

- `node server.js`：沿用本机 JSON 账号模式。不要因为未配置云端就改用它冒充云端通过。
- `lib/account-store.js`：本机与 Supabase 数据访问，失败不自动降级到 JSON，不自动重试不确定写入。
- `supabase/schema.sql`：两张专用空表和权限校验，不导入账号行。执行前应确认没有同名业务表；不要对已建好的库重复执行。
- `api/register.js`、`login.js`、`logout.js`、`me.js`：Vercel 入口，共用 `server.js` 的账号逻辑；缺少云端配置时拒绝服务，不写临时 JSON。
- `scripts/configure-cloud.cjs`：由 Owner 在自己的终端隐藏输入 Secret key，写入被 Git 忽略的 `.env.local`；不会覆盖已有文件，不修改 Windows 环境变量。
- `scripts/check-cloud.cjs`：显式读取 `.env.local`，不回退到继承的进程环境；对两张表各发一次 `limit=0` 的只读检查，不读取账号行或创建会话。
- `scripts/start-cloud.cjs`：由 Owner 手动启动本机云端测试服务，地址仍为 `http://127.0.0.1:3000/`；不读取或修改原 `data/`。

本机云端测试前，Owner 应先在原终端按 Ctrl+C 停止旧服务，再运行新入口。不要关闭或改写其他进程、改变系统权限来抢占端口。

## 所需配置

本机通过隐藏输入脚本生成以下名称，密钥真实值不应出现在本文：

- `DATA_BACKEND=supabase`
- `SUPABASE_URL`：本项目的 HTTPS 地址。
- `SUPABASE_SECRET_KEY`：以 `sb_secret_` 开头的服务端 Secret key。不是浏览器 Publishable key。

部署时还需在原 Vercel 项目的 Production 服务端设置 `APP_ORIGIN=https://qinzi-ai-lab.vercel.app`。Vercel 的密钥配置必须由 Owner 安全输入或通过已明确授权的安全凭据入口完成，不配置给前端或不受信的预览分支。

`vercel.json` 调用 `node scripts/build-static.cjs`，仅把四个网页文件和三张参考图复制到 `dist/` 作为静态输出；`api/` 单独作为 Node.js Functions 打包。`data/`、`.env.local`、测试、说明和服务端源码不属于公开静态文件。函数位于东京 `hnd1`，与现有数据库地区一致；没有增加依赖或付费服务。

## 验收与未完成项

- 离线测试：`node --test tests/cloud-account.test.cjs`。使用独立合成数据目录，测试结束清理该测试目录，不动 Owner 的 data。
- 已覆盖密码哈希、会话轮换/过期/退出、旧格式兼容、来源检查、HTTPS Cookie、服务端密钥格式、无进程环境回退及不确定请求停止。
- 第一轮出现 7 项失败，原因是测试将字符串流当作真实 HTTP Buffer 流；修正测试输入后，第二轮 13 项全通过。没有为通过测试删除断言或修改密码规则。
- 2026-11-20 两表 `limit=0` REST 连通通过；Owner 随后在本机云端测试模式实测注册、登录、刷新保持登录、退出重登及错误密码提醒正常。账号内容、密码及会话凭据不保存在验收报告。
- 2026-11-21 离线账号与发布打包共 15 项通过，额外证明静态输出只有七个文件、四个函数入口复用原处理器。公网 HTTP 验证注册、错误密码、登录、会话延续/轮换、退出、重登、跨站拒绝及私有文件 404；浏览器独立合成账号验证注册、登录、刷新、退出、错误密码及重登。原账号未导入。
- 首次公网脚本在静态资源比较阶段 FAIL：错误地把本机 CRLF 工作副本与 Git 中 LF 字节比较；已通过有界只读检查证明七个公开资源均与发布提交一致，保留原失败报告，不修改产品代码或重跑整条账号测试冒充修复。
- 当前不导入旧账号。是否迁移旧昵称、盐与密码哈希，需在目标与范围明确后由 Owner 确认；旧登录会话不应直接当作公网新登录。
- 上线前仍需核对公网滥用防护、免费额度和会话过期清理。当前准备不宣称具备生产级账号运营能力。

## 官方依据（2026-11-20 阅读）

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)：新 Secret key 通过 apikey 请求头使用，不能当作 JWT Bearer token；仅用于后端。
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)：表级授权与 RLS 分别控制可达性和行访问。
- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)：共用 Node 请求处理逻辑，并兼容平台已解析的 JSON 请求体。
