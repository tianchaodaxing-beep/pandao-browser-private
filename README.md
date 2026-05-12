# PANDAO 浏览器

> 🐼 **内部多账号防关联浏览器 + AI 操作执行环境**

## 一句话定位

替代紫鸟浏览器,**没有插件限制 + AI 能进**。给 10 人韩国电商团队 + 秘书 AI 用,管 5-6 个韩国店铺(Naver / Coupang / Gmarket / 11번가)。

## 跟 PANDAO 网站什么关系

**共用品牌名,代码完全独立。**

| 项目 | 路径 | 定位 | 受众 |
|---|---|---|---|
| **PANDAO 网站** | `F:\PANDAO\` | 对外韩国卖家社区 | 全球卖家 |
| **PANDAO 浏览器** | `F:\pandao-browser\`(本项目) | 内部团队工具 | 自己人 + AI |

数据库、服务器目录、git 仓库**全部独立**,不共享代码。

## 立项决定单(2026-05-08 老板拍板)

| 维度 | 决定 |
|---|---|
| 防关联深度 | **中层**(Cookie/UA/时区/分辨率/Canvas/WebGL/字体/音频 全套指纹隔离) |
| AI 接入 | **双轨**:指令清单(80%)+ 上帝视角 CDP(20%) |
| 账号库 | 服务器 **AES-256-GCM** 加密托管,员工永远看不到密码 |
| 客户端登录 | 账号密码(不要 TOTP) |
| 韩国平台二次验证 | **不做自动化,人工处理**(系统只推送验证码请求,找额外人工收码) |
| 权限 | 4 层(老板 / 主管 / 员工 / 秘书 AI) |
| 代理 IP | LunaProxy 主用 + 922S5 备用,**一店一 IP 固定** |
| 操作日志 | 文字日志全留 + 关键动作截图,**保留 180 天** |
| 回放权限 | **只有老板能看** |
| 应急开关 | 一键全员强制下线 + cookie 失效 |
| 形态 | Electron 桌面客户端 + 中央服务器 |
| 部署 | xinhuonianhua.com 现有 Windows 服务器,独立目录 |
| 节奏 | **2-3 个月做扎实** |

## 文档导航

| 文档 | 给谁看 | 内容 |
|---|---|---|
| [01-架构规范](docs/01-架构规范.md) | Codex / 程序员 | 技术蓝图、模块、表结构、API |
| [02-边界系统清单](docs/02-边界系统清单.md) | 老板 + Codex | AI 能做啥/不能做啥的详细矩阵 |
| [03-工单清单](docs/03-工单清单.md) | 老板派工用 | 15 张 WO,P0→P2 分级 |

## 历史

- 2026-05-08 上午 11:12 Codex 搭过 v0.1 雏形 `F:\crossborder-browser-workbench`,只做基础环境隔离 + 代理。
- 老板(2026-05-08 下午)决定不复用,重起 v1.0(本项目)。旧目录保留作历史归档,不动。

## 实施流程(AI 工作室 v1)

```
Claude(Opus,主控)         → 出规范文档(本仓库 docs/)
        ↓
老板审 + 派 WO 工单         → docs/03-工单清单.md
        ↓
Codex(程序员,Sonnet)       → 执行,代码进 client/ 和 server/
        ↓
老板验收 → 派下一张
```

## 目录结构(WO-001 后会建立)

```
F:\pandao-browser\
├── README.md            # 本文件
├── docs/                # 规范文档(本仓库已有)
│   ├── 01-架构规范.md
│   ├── 02-边界系统清单.md
│   └── 03-工单清单.md
├── client/              # Electron 客户端(WO-001 后建立)
├── server/              # Node.js 服务器(WO-001 后建立)
└── shared/              # 共享类型(WO-001 后建立)
```

## WO-001 本地启动

要求:

- Node.js 20+
- npm 10+
- PostgreSQL 15+，独立数据库名 `pandao_browser`

首次安装:

```powershell
cd F:\pandao-browser
npm install
```

启动服务端:

```powershell
npm run dev:server
```

健康检查:

```powershell
curl http://127.0.0.1:3001/health
```

启动客户端:

```powershell
npm run dev:client
```

工程检查:

```powershell
npm run typecheck
npm run build
```

数据库迁移框架位于 `server\migrations\`。本阶段只准备迁移管线，业务表从 WO-002 开始增加。

## WO-002 登录链路

服务端启动前必须设置 JWT 密钥，禁止默认密钥:

```powershell
$env:JWT_SECRET = "改成你的本地 access 密钥"
$env:JWT_REFRESH_SECRET = "改成你的本地 refresh 密钥"
npm run dev:server
```

首次建老板账号:

```powershell
$env:BOSS_PASSWORD = "至少12位且包含字母和数字"
npm run seed:admin -w server
```

登录接口演示:

```powershell
curl -X POST http://127.0.0.1:3001/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"username\":\"boss\",\"password\":\"你的老板密码\"}'
```

客户端登录:

```powershell
npm run dev:client
```

登录态写入 Electron `app.getPath("userData")\auth.bin`，由 `safeStorage` 加密，不保存明文密码。

## WO-003 店铺账号库与主密钥

生成主密钥:

```powershell
cd F:\pandao-browser
npm run keygen
```

输出位置固定为 `C:\Users\tianc\.pandao-key\master.key`。如果文件已存在，命令会报错并拒绝覆盖。

启动服务端:

```powershell
cd F:\pandao-browser
npm run dev:server
```

确认服务端启动后默认处于锁定状态:

```powershell
curl.exe -H "Authorization: Bearer <老板JWT>" http://127.0.0.1:3001/admin/lock-status
```

老板手动 unlock:

```powershell
curl.exe -X POST http://127.0.0.1:3001/admin/unlock `
  -H "Authorization: Bearer <老板JWT>" `
  -H "Content-Type: application/octet-stream" `
  --data-binary "@C:\Users\tianc\.pandao-key\master.key"
```

创建店铺:

```powershell
curl.exe -X POST http://127.0.0.1:3001/shops `
  -H "Authorization: Bearer <老板JWT>" `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"测试店铺\",\"platform\":\"naver_smartstore\",\"defaultUrl\":\"https://smartstore.naver.com/\"}'
```

设置店铺账号密码:

```powershell
curl.exe -X POST http://127.0.0.1:3001/shops/1/credentials `
  -H "Authorization: Bearer <老板JWT>" `
  -H "Content-Type: application/json" `
  -d '{\"username\":\"店铺登录账号\",\"password\":\"店铺登录密码\"}'
```

验证读接口不会返回密文字段:

```powershell
curl.exe -H "Authorization: Bearer <老板JWT>" http://127.0.0.1:3001/shops/1
```

## WO-004 打开店铺窗口

启动服务端和客户端:

```powershell
cd F:\pandao-browser
npm run dev:server
npm run dev:client
```

客户端流程:

1. 用 boss 账号登录。
2. 进入「店铺列表」。
3. 点击店铺右侧「打开店铺」。
4. 系统会按店铺 ID 打开独立窗口，窗口标题为 `{店铺名} - PANDAO Browser`。
5. 同一店铺重复点击会聚焦已有窗口，不会重复开窗。

店铺窗口数据隔离验证:

```powershell
Get-ChildItem "$env:APPDATA\pandao-browser\Partitions"
```

期望能看到类似 `shop-1`、`shop-6` 的独立目录，每个目录内有自己的 `Network\Cookies` 文件。

## WO-005 员工打开店铺 → 自动填密码

服务端先保持解锁状态，否则一次性凭证兑换会返回 `KEY_LOCKED`:

```powershell
curl.exe -X POST http://127.0.0.1:3001/admin/unlock `
  -H "Authorization: Bearer <老板JWT>" `
  -H "Content-Type: application/octet-stream" `
  --data-binary "@C:\Users\tianc\.pandao-key\master.key"
```

接口链路演示:

```powershell
curl.exe -H "Authorization: Bearer <员工或老板JWT>" `
  http://127.0.0.1:3001/shops/1/credential-token

curl.exe -X POST http://127.0.0.1:3001/credentials/exchange `
  -H "Authorization: Bearer <同一用户JWT>" `
  -H "Content-Type: application/json" `
  -d '{\"token\":\"<一次性credentialToken>\"}'
```

客户端流程:

1. 用有店铺权限的账号登录客户端。
2. 进入「店铺列表」并点击「打开店铺」。
3. 店铺窗口加载到对应平台登录页时，主进程自动签 60 秒一次性凭证并兑换账号密码。
4. 系统只自动填入用户名和密码，不自动点登录按钮；员工确认页面正确后手动登录。
5. 密码不进入渲染进程、IPC、safeStorage、日志或截图。

## WO-006 中层指纹隔离

新建店铺会由服务端自动生成并固化 `fingerprint_config`，老店铺用 CLI 一次性补齐:

```powershell
cd F:\pandao-browser
npm run regenerate-fingerprints
```

命令只输出店铺 ID 和 8 位校验指纹，不输出完整指纹配置。已有 `fingerprint_config` 的店铺不会被覆盖。

启动客户端后打开店铺窗口，主进程会在独立 partition 上设置 UA 和权限策略，并在 `dom-ready` 注入 stealth 脚本:

```powershell
npm run dev:server
npm run dev:client
```

验证建议:

1. 打开两个不同店铺。
2. 分别访问 canvas / WebGL / WebRTC 检测页。
3. 两个店铺的 canvas hash、WebGL renderer、UA、屏幕、时区等应按各自店铺固定值隔离。
4. 关闭店铺窗口后重新打开，同一店铺指纹应保持不变。

## WO-007 代理 IP 集成

数据库迁移会创建 `proxies` 表,并给 `shops.proxy_id` 补上代理外键:

```powershell
cd F:\pandao-browser
npm run migrate
```

老板端流程:

1. 登录客户端并进入“代理 IP”。
2. 手工录入代理,或导入 CSV: `provider,protocol,host,port,username,password,country,city`。
3. 在代理列表中选择店铺并绑定;一个店铺固定一个代理。
4. 解绑会同时清空 `proxies.bound_shop_id` 和 `shops.proxy_id`。

店铺窗口流程:

1. 打开有代理绑定的店铺时,主进程先读取 `/shops/:id/proxy`。
2. Electron session 执行 `setProxy`,代理认证通过 `/shops/:id/proxy-credential` 临时读取。
3. 访问 `http://api.ipify.org` 做 5 秒连通检查,通过后才加载店铺 URL。
4. 没有绑定代理的店铺保持原流程。

## WO-008 操作日志与关键动作截图

本地开发建议把截图数据放到 `.dev-data`，生产默认路径为 `C:\pandao-browser-server\data`:

```powershell
$env:PANDAO_DATA_ROOT = "F:\pandao-browser\.dev-data"
npm run dev:server
npm run dev:client
```

接口链路演示:

```powershell
curl.exe -X POST http://127.0.0.1:3001/actions/log `
  -H "Authorization: Bearer <老板或员工JWT>" `
  -H "Content-Type: application/json" `
  -d '{\"actor_type\":\"human\",\"shop_id\":1,\"action_type\":\"product.price.update\",\"before\":{\"price\":10000},\"after\":{\"price\":11000},\"risk_level\":\"green\"}'
```

截图上传只接受 PNG，单文件不超过 4MB，保存到:

```text
<PANDAO_DATA_ROOT>\screenshots\YYYY\MM\DD\<uuid>.png
```

客户端流程:

1. 登录客户端并打开店铺窗口。
2. 店铺窗口加载后 1 秒注入 DOM 监听器。
3. 命中 `action-selectors` 的关键按钮后，主进程上报 `/actions/log`。
4. 对商品价格、退款、上下架等必截动作，主进程调用 `webContents.capturePage()` 并上传 `/actions/screenshot`。
5. 离线时只缓存日志到 `app.getPath("userData")\action-queue.jsonl`，不缓存截图；恢复联网后批量补传日志。

清理任务:

```powershell
npm run cleanup -w server
```

生产环境 `NODE_ENV=production` 且 `CRON_DISABLED` 不为 `true` 时，每天 03:00(上海时间)清理超过 180 天的日志和截图。开发环境不会自动清理。

---

文档版本:v1.0
立项日期:2026-05-08
主控:Claude(Opus 4.7)
实施:Codex
