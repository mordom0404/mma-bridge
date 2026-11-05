# mma-bridge

Meteor Master AI 启动器 & 命令行工具 - 通过命令行快速启动 Windows 和 macOS 上的 Meteor Master AI，并调用其本地 MMABridge API。

**版本 2.0.0** · 需要 **Meteor Master AI ≥ 5.15.0**（v2 MMABridge 协议）。

**关于 MeteorMaster**：MeteorMaster 是一款强大的流星检测与分析工具。官网：https://photohelper.cn/meteormaster

## OpenClaw 和 Agent 集成

mma-bridge 专为 OpenClaw 或类似的 AI agent 系统设计，用于快速接入 Meteor Master AI 的能力。推荐配合对应的 Skill 一起使用：

- Skill 页面（安装命令、API 文档）：**https://clawhub.ai/mordom0404/skills/mma-bridge**
- 安装 Skill：`openclaw skills install @mordom0404/mma-bridge`

该 Skill 写明了版本要求（App ≥ 5.15.0、CLI ≥ 2.0.0），包含下面的「首次接入自检」，并记录了全部 15 个 API 方法。

通过结合 mma-bridge 和对应的 Skill，agent 可以轻松实现流星检测、数据分析和结果处理等功能。

[English Version](https://github.com/mordom0404/mma-bridge/blob/master/README.md) | [中文版本文档](https://github.com/mordom0404/mma-bridge/blob/master/README.zh-CN.md)

## 版本要求

| 组件 | 要求 | 说明 |
|---|---|---|
| Meteor Master AI（App） | **≥ 5.15.0** | v2 MMABridge 协议从 App 5.15.0 起提供；更低的 App 是 v1 bridge，本 CLI **不支持**（见「连到旧版 App」） |
| mma-bridge（本 CLI） | **≥ 2.0.0** | 每个请求都会带 `X-MMA-Bridge: mma-bridge/<版本>` 与 `X-MMA-Skill: 2.0.0` 版本头，由 App 校验 |
| Node.js | ≥ 14 | |

App 版本查看方式：显示在 App **主界面标题栏**里、`Meteor Master AI` 右侧（如 `5.15.0`）；也可以调用 `getCurrentInfo` 读 `data.appVersion`。如果应用商店里的最新版仍低于 5.15.0，请先更新 App。

## 安装

```bash
# 先钉版本再核对。如果 npm 的 latest 标签还指向旧版，只跑 `npm install -g mma-bridge`
# 会静默装到 1.x，之后每次 `mma post` 都会被 App 以 OUTDATED_CLI 拒绝。
npm install -g mma-bridge@2.0.0
mma --version   # 必须输出 2.0.0 或更高
```

升级已安装的旧版本：

```bash
npm install -g mma-bridge@latest
mma --version
```

## 首次接入自检（新机器 / Agent 必做）

第一次使用前先跑一遍，全部通过再调用业务方法；任一步失败请停下并看「常见失败」：

1. `mma --version` → 必须为 `2.0.0` 或更高。
2. `mma check` → 确认 Meteor Master AI 已安装；未安装请先从 Microsoft Store / App Store 安装。
3. App 未运行则 `mma start`。
4. `mma list` → 等到输出 `Valid ports:`。App 刚启动时 bridge 端口可能要 **1–10 秒** 才就绪，建议每秒重试一次、最多 10 次。
5. `mma post --method getCurrentInfo` → 校验三项：
   - `data.bridgeProtocolVersion === "2.0.0"`；
   - `data.appVersion` ≥ `5.15.0`；
   - `data.supportMMABridgeMethods` 含全部 **15 个方法**（含 `adjustResult` / `addResult`）。

全部满足后再调用业务方法。

## ⚠️ 2.0.0 破坏性变更

mma-bridge 2.0.0 使用 **v2 MMABridge 协议**，与 1.x **不兼容**：

- 每个 `post` / `list` 请求都会携带版本头 `X-MMA-Bridge: mma-bridge/2.0.0` 和 `X-MMA-Skill: 2.0.0`。App 会校验版本：旧版 CLI（1.x）会被拒绝并返回 `OUTDATED_CLI` / `OUTDATED_SKILL`。
- 回包统一为 v2 信封：成功 `{ "success": true, "message": "...", "data": ... }`；业务失败 `{ "success": false, "code": "...", "message": "...", "data": null }`（HTTP 仍可能是 200）。
- `mma post` 在 `success:false` 时**退出码为 1**（JSON 仍打印到 stdout）；网络错误 / HTTP 错误同样退出码 1。
- 隐藏的 `--data` 选项已**删除**，只保留 `--data-file <path>`。
- `mma list` 探活失败时**不再删除**实例文件，只提示并保留。
- CLI 日志已移出实例注册表目录，改到 `%TEMP%/MeteorMasterAI/mma-bridge-logs/`（见「日志」）。

### 连到旧版 App（< 5.15.0）

v1 bridge（App 5.14.x 及更早）**不校验版本头**：请求可能照样「成功」，但契约完全不同：

- 回包**没有 `code` 字段**；
- 业务失败仍以 `success: true` 返回，错误信息塞在 `data` 里（`success` 不可信）；
- `getCurrentInfo` 里**没有 `bridgeProtocolVersion` / `minCliVersion` / `minSkillVersion`**，`supportMMABridgeMethods` 只有 13 个方法；
- `adjustResult` / `addResult` 不存在，约 5 秒后返回 `{success:false, message:"Request timeout or invalid request url"}`（同样没有 `code`）。

出现任意一条都说明 **App 太旧**：请让用户把 Meteor Master AI 更新到 5.15.0+，不要重试。

## 使用

### 检查是否安装了 Meteor Master AI

```bash
mma check
```

未安装时退出码为 1。

### 启动 Meteor Master AI

```bash
mma start
```

### 列出运行中的实例的端口

```bash
mma list
```

该命令将执行以下操作：

1. 从 `%TEMP%/MeteorMasterAI/mma-bridge-registry/` 读取实例文件
2. 通过 `POST /health` 检查每个实例的健康状态（3 秒超时）
3. 探活失败的实例文件**保留不删**（只警告，避免误删正在启动/重启的 App）
4. 输出 `Valid ports:` 及健康实例的端口

示例输出：

```text
Valid ports: 9000 9002
```

### 发送 API 请求

> ⚠️ **重要提示**：Meteor Master AI 仅允许通过 `mma` 命令进行交互，不支持直接 HTTP 请求。这是与 Meteor Master AI 通信的唯一官方方式。

```bash
mma post --method <methodName> [--port <port>] [--host <host>] [--token <token>] [--data-file <filePath>]
```

参数说明：

- `--method`：**必需**，API 方法名称（共 15 个方法，见 skill 文档 `skill/references/api_spec.md`）
- `--port`：可选，API 服务器端口，**1–65535** 的整数，默认 **9000**。同一台电脑有多个实例时，先用 `mma list` 查看端口，再用 `--port` 指定
- `--host`：可选，App 所在机器的 IP（或主机名），默认 **127.0.0.1**。只有在 App 设置里打开了「允许局域网访问」并从**另一台设备**调用时才需要它
- `--token`：可选，局域网访问令牌。也可以用环境变量 `MMA_BRIDGE_TOKEN` 传入（命令行优先）。令牌从 App 的「设置 → MMABridge → 允许局域网访问」里复制
- `--data-file`：**可选**，JSON **对象**请求体文件路径。**省略等价于 `{}`**。请求体不能包含 `uuid` 字段（由服务端注入）

响应会以 JSON 打印到 stdout；`success:false` 时退出码为 1。

> **本机调用不需要 token**：App 只对「非本机来源」的请求要求令牌，从本机连 `127.0.0.1` 照常直接用即可。

#### 使用方法

```bash
# 不需要参数时可以省略 --data-file
mma post --method getCurrentInfo

# 需要参数时先写 JSON 文件
echo '{"orderBy":0,"sort":"DESC","pageSize":10,"pageIndex":1}' > data.json
mma post --method getDataList --data-file data.json --port 9000
```

#### 示例

```bash
# 获取当前信息（默认端口 9000）
mma post --method getCurrentInfo

# 指定端口号
mma post --method getCurrentInfo --port 9000

# 完整示例
echo '{"id":"12345"}' > data.json
mma post --method getDataDetail --port 9000 --data-file data.json
```

### 局域网访问

在 App 的「设置 → MMABridge」里勾选「允许局域网访问」后，同一局域网内的其它设备可以调用本机：

```bash
# 从另一台设备调用（App 机器的 IP + 令牌）
mma post --method getCurrentInfo --host 192.168.0.113 --port 9000 --token <token>

# 或者用环境变量传令牌
export MMA_BRIDGE_TOKEN=<token>
mma post --method getCurrentInfo --host 192.168.0.113 --port 9000
```

说明：

- 令牌在 App 设置页里明文显示，复制后用 `--token` 或 `MMA_BRIDGE_TOKEN` 传入；
- 缺少或传错令牌 → HTTP **401** + `UNAUTHORIZED` 信封，CLI 退出码为 **1**，并额外打印一行提示告诉你去哪儿取令牌；
- App 只监听本机（`127.0.0.1`）时，其它设备**连不上** —— 必须先在设置里打开「允许局域网访问」；
- `mma list` 始终只发现**本机**实例（读本机临时目录里的实例文件），不接受 `--host`；
- 端口在 9000–10000 之间漂移，远端保存的端口可能失效，用 `mma list` 或 App 设置页确认当前端口；
- 浏览器不能直接调用：服务端会拒绝带 `Origin` 头的请求（防 DNS rebinding / CSRF）。

### 帮助 / 版本

```bash
mma --help
mma --version
```

`--version` 输出 CLI 版本（`2.0.0`）。这两个命令都不会创建日志会话。

## 常见失败

| 现象 | 原因 | 处理 |
|---|---|---|
| `OUTDATED_CLI` / `OUTDATED_SKILL` | CLI（或 skill）低于 2.0.0 | `npm install -g mma-bridge@latest`，用 `mma --version` 核对；skill 用 `openclaw skills install @mordom0404/mma-bridge` 升级 |
| `mma list` 一直没有 `Valid ports:` | App 没运行 / 没启用 MMABridge / 端口还没就绪 | `mma start`；在「设置 → 通用设置 → MMABridge」启用；再重试 `mma list` |
| `ECONNREFUSED` | App 没运行 / 没启用 MMABridge | `mma start` + 打开开关 |
| `success:true` 但 body 里是错误字符串，或回包没有 `code`，或 `getCurrentInfo` 没有 `bridgeProtocolVersion` | App < 5.15.0（v1 bridge） | 把 App 更新到 5.15.0+（见「连到旧版 App」） |
| 约 5 秒后返回 `Request timeout or invalid request url` 且无 `code` | 旧版 App（方法不存在）或方法名写错 | 先确认 App 版本；方法名大小写敏感（共 15 个） |
| HTTP 401 + `UNAUTHORIZED` | 缺少/错误令牌，或请求带了 `Origin` 头 | 从「设置 → MMABridge → 允许局域网访问」复制令牌，用 `--token` / `MMA_BRIDGE_TOKEN` 传入；浏览器不能直接调用 |
| `ETIMEDOUT`（约 21 秒）/ `EHOSTUNREACH` | 连接被防火墙静默丢弃 / 主机离线或 IP 不对 | 允许 App 通过防火墙 / 核对 IP |
| 之前能用的端口突然不通 | bridge 端口在 9000–10000 间漂移 | 用 `mma list` 或 App 设置页确认当前端口 |

## 日志

CLI 日志写入 `%TEMP%/MeteorMasterAI/mma-bridge-logs/`（`log-<时间戳>.log`），**不再写入**实例注册表目录，因此不会干扰 `mma list` 的实例发现。

- 只有**实际执行命令**（`start` / `check` / `post` / `list`）才会创建一个日志文件；
- `mma --help` / `mma --version` **不写**日志（在日志会话开始前就退出）。

每次会话开始时按「最多 **30** 个文件（**含当前会话这个**）/ 最多 **7** 天」清理旧日志。

## 工作原理

### Windows

1. 通过 PowerShell 的 `Get-StartApps` 命令检查系统是否安装了 Meteor Master AI
2. 如果已安装，提取应用的 AppID
3. 使用 `explorer.exe shell:{AppID}` 格式启动应用

### macOS

1. 使用 `mdfind -name "Meteor Master AI.app"` 检查系统是否安装了 Meteor Master AI
2. 如果已安装，使用 `open -a "Meteor Master AI"` 启动应用

## 调试

程序包含详细的 console 输出，且每次实际执行命令（`start` / `check` / `post` / `list`）都会写入 `%TEMP%/MeteorMasterAI/mma-bridge-logs/`。也可以直接运行：

```bash
node node_modules/mma-bridge/src/cli.js post --method getCurrentInfo
```

## 开发

```bash
# 克隆项目
git clone https://github.com/mordom0404/mma-bridge.git
cd mma-bridge

# 安装依赖
npm install

# 本地测试
npm link
mma --version
```

## 许可证

MIT
