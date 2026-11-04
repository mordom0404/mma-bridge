#!/usr/bin/env node
"use strict";

// mma-bridge CLI 2.0.0
// - 与 Meteor Master AI 的 v2 协议配套：请求头 X-MMA-Bridge / X-MMA-Skill，回包统一信封
// - success:false 时打印 JSON 并退出码 1
// - 只保留 --data-file（可省略 = {}），删除历史隐藏 --data
// - list 探活失败不删实例文件（避免误删正在启动/重启的实例）
// - 日志移出 registry 目录，单独放 %TEMP%/MeteorMasterAI/mma-bridge-logs/ 并按数量/天数清理
// - 局域网访问（2026-11-04）：--host 指定 App 机器 IP，--token / MMA_BRIDGE_TOKEN 传访问令牌；
//   本机 loopback 调用免 token（与 App 侧规则一致）
// 纯 CommonJS，保持 Node >= 14 兼容（不使用 ?. / ??）。

const { checkMeteorMasterAI, launchMeteorMasterAI } = require("./index");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const packageJson = require("../package.json");
const MMA_BRIDGE_VERSION = packageJson.version;
// skill 版本：与 skill/SKILL.md 的 frontmatter version 保持一致，随 skill 文档一起 bump
const SKILL_VERSION = "2.0.0";

// post 的 HTTP 超时：CLI 侧等待上限。
// App 端超时表最长 30s（getDataList / getCurrentInfo / analyzeVideoFile），
// CLI 取 35s（30s + 5s 余量）以覆盖最长方法。
// ★ 计划 §9 原文写 15s「覆盖 App 端最长方法」，前提不成立（15s < 30s 会先于服务端超时），
//   这里按计划**意图**调整为 35s。
const DEFAULT_HTTP_TIMEOUT_MS = 35000;
const HEALTH_TIMEOUT_MS = 3000;

// 日志保留策略：最多 30 个文件（**含当前会话**）/ 最多 7 天
const LOG_MAX_FILES = 30;
const LOG_RETENTION_DAYS = 7;
const LOG_FILE_PATTERN = /^log-.*\.log$/;

// 测试可用环境变量覆盖 HTTP 超时（不写进 README/help，不构成对外承诺）
function getHttpTimeoutMs() {
  const raw = process.env.MMA_BRIDGE_HTTP_TIMEOUT_MS;
  if (raw === undefined || raw === "") {
    return DEFAULT_HTTP_TIMEOUT_MS;
  }
  const parsed = parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_HTTP_TIMEOUT_MS;
  }
  return parsed;
}

// 临时目录布局：
//   %TEMP%/MeteorMasterAI/mma-bridge-registry/  —— App 写的实例文件（instance-<port>.json）
//   %TEMP%/MeteorMasterAI/mma-bridge-logs/      —— CLI 自己的日志（与实例发现互不干扰）
function getTempRoot() {
  return path.join(os.tmpdir(), "MeteorMasterAI");
}

function getRegistryDir() {
  return path.join(getTempRoot(), "mma-bridge-registry");
}

function getLogDir() {
  return path.join(getTempRoot(), "mma-bridge-logs");
}

// 1.x 的日志写在 registry 目录里（log-<timestamp>.log）。2.0 起日志搬到 mma-bridge-logs/，
// 这里顺手清掉 registry 目录里的历史日志（只匹配 log-*.log，绝不碰 instance-*.json）。
function cleanupLegacyLogsInRegistry() {
  const registryDir = getRegistryDir();
  let files = [];
  try {
    files = fs.readdirSync(registryDir);
  } catch (error) {
    return;
  }
  for (let i = 0; i < files.length; i++) {
    if (!LOG_FILE_PATTERN.test(files[i])) {
      continue;
    }
    try {
      fs.unlinkSync(path.join(registryDir, files[i]));
    } catch (error) {
      console.error("[WARN] Failed to remove legacy log file: " + error.message);
    }
  }
}

/**
 * 日志脱敏：把 argv 里的访问令牌替换掉再写日志。
 * ★ --token 的值是局域网访问令牌，等同密码 —— 落到日志文件里就等于
 *   把令牌散落在磁盘上（%TEMP%/MeteorMasterAI/mma-bridge-logs/ 最多留 30 份 / 7 天）。
 *   App 侧守住的是「绝不写日志」，CLI 侧同样要守住。
 * 注意：令牌也可以从环境变量 MMA_BRIDGE_TOKEN 来，那本来就不在 argv 里，不受影响。
 * @param {Array} args 原始 argv
 * @returns {Array} 脱敏后的副本（不改原数组）
 */
function redactArgsForLog(args) {
  const list = Array.isArray(args) ? args.slice() : [];
  for (let i = 0; i < list.length; i++) {
    const arg = list[i];
    if (typeof arg !== "string") {
      continue;
    }
    // --token <value>
    if (arg === "--token" && i + 1 < list.length) {
      list[i + 1] = "<redacted>";
      i++;
      continue;
    }
    // --token=<value>
    if (arg.indexOf("--token=") === 0) {
      list[i] = "--token=<redacted>";
    }
  }
  return list;
}

/**
 * 日志管理器：
 * - 每次实际执行命令（start/check/post/list）开一个 log-<timestamp>.log；
 * - 启动新会话前按「最多 30 个文件 / 最多 7 天」清理旧日志；
 * - --help / --version 不创建日志会话，避免写垃圾日志。
 */
class LogManager {
  constructor(logDir) {
    this.logDir = logDir;
    this.currentLogFile = null;
    this.currentStream = null;
    this.inSession = false;
  }

  ensureLogDir() {
    if (fs.existsSync(this.logDir)) {
      return;
    }
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch (error) {
      console.error("[WARN] Failed to create log directory: " + error.message);
    }
  }

  // 按数量 + 天数清理旧日志（失败只 warn，不影响命令执行）
  cleanupOldLogs() {
    let entries = [];
    try {
      entries = fs.readdirSync(this.logDir);
    } catch (error) {
      return;
    }
    const now = Date.now();
    const maxAgeMs = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const logs = [];
    for (let i = 0; i < entries.length; i++) {
      const name = entries[i];
      if (!LOG_FILE_PATTERN.test(name)) {
        continue;
      }
      const filePath = path.join(this.logDir, name);
      try {
        const stats = fs.statSync(filePath);
        logs.push({ path: filePath, mtimeMs: stats.mtimeMs });
      } catch (error) {
        // 文件刚好被删掉，跳过
      }
    }
    // 新的在前
    logs.sort(function (a, b) {
      return b.mtimeMs - a.mtimeMs;
    });
    // 注意：cleanup 发生在**创建本次会话日志之前**，所以这里只能保留 LOG_MAX_FILES - 1 个历史文件，
    // 加上本次新建的那个才不超过 LOG_MAX_FILES（曾经的 i >= LOG_MAX_FILES 会出现 31 个）。
    const keepCount = LOG_MAX_FILES - 1;
    for (let i = 0; i < logs.length; i++) {
      const shouldDelete = i >= keepCount || now - logs[i].mtimeMs > maxAgeMs;
      if (!shouldDelete) {
        continue;
      }
      try {
        fs.unlinkSync(logs[i].path);
      } catch (error) {
        console.error("[WARN] Failed to remove old log file: " + error.message);
      }
    }
  }

  begin(command, args) {
    this.inSession = true;
    cleanupLegacyLogsInRegistry();
    this.ensureLogDir();
    this.cleanupOldLogs();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.currentLogFile = path.join(this.logDir, "log-" + timestamp + ".log");
    try {
      this.currentStream = fs.createWriteStream(this.currentLogFile, { flags: "a" });
    } catch (error) {
      console.error("[WARN] Failed to open log file: " + error.message);
      this.currentStream = null;
    }
    this.write(
      "\n========================================\n" +
        "MMA-Bridge Log Session (v" +
        MMA_BRIDGE_VERSION +
        ")\nStarted at: " +
        new Date().toISOString() +
        "\n========================================\n"
    );
    this.logInput(command, args);
  }

  write(content) {
    if (!this.currentStream) {
      return;
    }
    this.currentStream.write(content);
  }

  logInput(command, args) {
    const inputLog =
      "\n[" +
      new Date().toISOString() +
      "] COMMAND INPUT\nCommand: " +
      command +
      "\nArguments: " +
      JSON.stringify(redactArgsForLog(args), null, 2) +
      "\n----------------------------------------\n";
    this.write(inputLog);
  }

  logOutput(content) {
    this.write(
      "\n[" + new Date().toISOString() + "] " + content + "\n----------------------------------------\n"
    );
  }

  logError(content) {
    this.write(
      "\n[" +
        new Date().toISOString() +
        "] ERROR\n" +
        content +
        "\n========================================\n"
    );
  }

  end() {
    this.inSession = false;
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }
  }
}

// 日志管理器实例：仅实际执行命令时创建（help/version 不写日志）
let logManager = null;

// 拦截 console.log / console.error 写入日志（终端输出行为不变）
const originalConsoleLog = console.log;
console.log = function () {
  originalConsoleLog.apply(console, arguments);
  if (logManager) {
    const args = Array.prototype.slice.call(arguments);
    logManager.logOutput(formatLogArgs(args));
  }
};

const originalConsoleError = console.error;
console.error = function () {
  originalConsoleError.apply(console, arguments);
  if (logManager) {
    const args = Array.prototype.slice.call(arguments);
    logManager.logError(formatLogArgs(args));
  }
};

function formatLogArgs(args) {
  return args
    .map(function (arg) {
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (error) {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
}

// INFO/WARN 进度信息走 stderr：stdout 只留给「命令输出」（JSON 信封 / Valid ports / help / version），
// 方便脚本直接 `mma post ... | jq` 或 JSON.parse。
function infoLog(message) {
  originalConsoleError.apply(console, [message]);
  if (logManager) {
    logManager.logOutput(message);
  }
}

/**
 * 打印帮助
 */
function printHelp() {
  console.log("Usage: mma <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  start     Launch Meteor Master AI");
  console.log("  check     Check if Meteor Master AI is installed");
  console.log("  post      Send a POST request to the local MMABridge API");
  console.log("  list      List running Meteor Master AI instances");
  console.log("");
  console.log("Options:");
  console.log("  -h, --help       Show this help");
  console.log("  -v, --version    Print CLI version");
  console.log("");
  console.log("post options:");
  console.log("  --method <name>      Required, API method name (see skill/references/api_spec.md)");
  console.log("  --port <port>        Optional, integer 1-65535, default 9000");
  console.log("  --host <host>        Optional, App machine IP for LAN access, default 127.0.0.1");
  console.log("  --token <token>      Optional, LAN access token; also read from MMA_BRIDGE_TOKEN");
  console.log("  --data-file <path>   Optional, JSON request body file; omitted means {}");
  console.log("");
  console.log("Examples:");
  console.log("  mma check");
  console.log("  mma list");
  console.log("  mma post --method getCurrentInfo");
  console.log("  mma post --method getDataList --data-file data.json --port 9000");
  console.log("  mma post --method getCurrentInfo --host 192.168.0.113 --port 9000 --token <token>");
}

/**
 * 解析 --port：必须是 1-65535 的整数
 * @returns {number|null} 合法返回端口号，非法返回 null
 */
function parsePort(raw) {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    return null;
  }
  const port = parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return port;
}

/**
 * 解析 --host：局域网访问时 App 所在机器的 IP（或主机名）。
 * 校验：非空、不以 -- 开头、不含 /（避免把 URL 整个传进来）。
 * @returns {string|null} 合法返回 host，非法返回 null
 */
function parseHost(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const text = raw.trim();
  if (!text) {
    return null;
  }
  if (text.slice(0, 2) === "--") {
    return null;
  }
  // 含 / 一定不是裸 host（"://" 也被这一条挡掉）
  if (text.indexOf("/") !== -1) {
    return null;
  }
  if (text.indexOf("://") !== -1) {
    return null;
  }
  return text;
}

/**
 * 解析 post 命令参数
 * @returns {{error:string}|{method:string,port:number,host:string,token:string|null,dataFilePath:string|null}}
 */
function parsePostArgs(args) {
  let method = null;
  let port = 9000;
  // 默认只连本机（App 默认只监听 127.0.0.1）
  let host = "127.0.0.1";
  let token = null;
  let dataFilePath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }

    if (arg === "--method") {
      if (i + 1 >= args.length || isOptionToken(args[i + 1])) {
        return { error: "--method requires a value, e.g. --method getCurrentInfo" };
      }
      method = args[i + 1];
      i++;
    } else if (arg === "--port") {
      if (i + 1 >= args.length) {
        return { error: "--port requires a value (integer 1-65535)" };
      }
      const rawPort = args[i + 1];
      const parsedPort = parsePort(rawPort);
      if (parsedPort === null) {
        return {
          error:
            'Invalid --port value: "' +
            rawPort +
            '". Port must be an integer between 1 and 65535.',
        };
      }
      port = parsedPort;
      i++;
    } else if (arg === "--host") {
      if (i + 1 >= args.length || isOptionToken(args[i + 1])) {
        return { error: "--host requires a value, e.g. --host 192.168.0.113" };
      }
      const rawHost = args[i + 1];
      const parsedHost = parseHost(rawHost);
      if (parsedHost === null) {
        return {
          error:
            'Invalid --host value: "' +
            rawHost +
            '". Host must be a plain host name or IP address (no scheme, no path).',
        };
      }
      host = parsedHost;
      i++;
    } else if (arg === "--token") {
      if (i + 1 >= args.length || isOptionToken(args[i + 1])) {
        return { error: "--token requires a value, e.g. --token <token>" };
      }
      const rawToken = String(args[i + 1]).trim();
      if (!rawToken) {
        return { error: "--token requires a non-empty value" };
      }
      token = rawToken;
      i++;
    } else if (arg === "--data-file") {
      if (i + 1 >= args.length || isOptionToken(args[i + 1])) {
        return { error: "--data-file requires a file path, e.g. --data-file data.json" };
      }
      dataFilePath = args[i + 1];
      i++;
    } else if (arg === "--data") {
      return {
        error:
          "The hidden --data option was removed in 2.0.0. Use --data-file <path> (a JSON file) instead.",
      };
    } else {
      return { error: "Unknown option: " + arg };
    }
  }

  if (!method) {
    return {
      error:
        "--method parameter is required.\nUsage: mma post --method <methodName> [--port <port>] [--host <host>] [--token <token>] [--data-file <filePath>]",
    };
  }

  // token：命令行优先；没给就读环境变量 MMA_BRIDGE_TOKEN（脚本里统一注入更方便）
  if (!token) {
    const envToken = process.env.MMA_BRIDGE_TOKEN;
    if (typeof envToken === "string" && envToken.trim()) {
      token = envToken.trim();
    }
  }

  return {
    method: method,
    port: port,
    host: host,
    token: token,
    dataFilePath: dataFilePath,
  };
}

function isOptionToken(value) {
  return typeof value === "string" && value.slice(0, 2) === "--";
}

/**
 * 读取 --data-file（省略 = {}）
 * @returns {{error:string}|{data:object}}
 */
function loadRequestData(filePath) {
  if (!filePath) {
    return { data: {} };
  }

  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return { error: "Data file not found: " + filePath };
    }
    return { error: "Failed to read data file " + filePath + ": " + error.message };
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch (error) {
    return {
      error:
        "Invalid JSON in data file " +
        filePath +
        ": " +
        error.message +
        '\nExpected a JSON object, e.g. {"orderBy": 0, "sort": "DESC"}',
    };
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { error: "Data file " + filePath + " must contain a JSON object (e.g. {}), not an array or scalar." };
  }

  if (Object.prototype.hasOwnProperty.call(data, "uuid")) {
    return {
      error:
        "The request body must not contain a uuid field.\nUUIDs are injected by the server for security reasons and are not allowed in --data-file.",
    };
  }

  return { data: data };
}

/**
 * 处理 start 命令
 */
function handleStart() {
  console.log("[INFO] Executing start command...");

  const checkResult = checkMeteorMasterAI();

  if (!checkResult.exists) {
    console.error("\n[ERROR] Meteor Master AI is not installed.");
    console.error("Please purchase and install Meteor Master AI from the app store:");
    console.error("  - Windows: Microsoft Store");
    console.error("  - macOS: Mac App Store");
    console.error("\nOfficial website: https://photohelper.cn/meteormaster\n");
    process.exit(1);
  }

  launchMeteorMasterAI(checkResult.AppID);
}

/**
 * 处理 check 命令
 */
function handleCheck() {
  console.log("[INFO] Executing check command...");

  const result = checkMeteorMasterAI();

  if (result.exists) {
    console.log("\n✓ Meteor Master AI is installed");
    console.log("  AppID:", result.AppID);
    return;
  }

  console.error("\n✗ Meteor Master AI is not installed");
  console.error("Please purchase and install Meteor Master AI from the app store:");
  console.error("  - Windows: Microsoft Store");
  console.error("  - macOS: Mac App Store");
  console.error("\nOfficial website: https://photohelper.cn/meteormaster");
  process.exit(1);
}

/**
 * 处理 post 命令
 * @param {Array} args - 命令行参数数组
 */
async function handlePost(args) {
  const parsed = parsePostArgs(args);
  if (parsed.help) {
    printHelp();
    return;
  }
  if (parsed.error) {
    console.error("[ERROR] " + parsed.error);
    process.exit(1);
  }

  const loaded = loadRequestData(parsed.dataFilePath);
  if (loaded.error) {
    console.error("[ERROR] " + loaded.error);
    process.exit(1);
  }

  const apiUrl =
    "http://" + parsed.host + ":" + parsed.port + "/api/" + encodeURIComponent(parsed.method);
  infoLog("[INFO] Executing post command...");
  infoLog("[INFO] Sending POST request to: " + apiUrl);
  const bodyKeys = Object.keys(loaded.data);
  infoLog("[INFO] Request body keys: " + (bodyKeys.length ? bodyKeys.join(", ") : "(none)"));

  const timeoutMs = getHttpTimeoutMs();

  // 请求头：版本头 + 局域网 token。
  // ★ 只有「连非本机（App 开了允许局域网访问）」才需要 token；
  //   本机 loopback 调用 App 侧免 token —— 所以不传 --token 也能照常连本机。
  const headers = {
    "Content-Type": "application/json",
    // v2 版本头：CLI 自述版本 + skill 版本（App 会校验；/health 除外）
    "X-MMA-Bridge": "mma-bridge/" + MMA_BRIDGE_VERSION,
    "X-MMA-Skill": SKILL_VERSION,
  };
  if (parsed.token) {
    headers["X-MMA-Token"] = parsed.token;
  }

  try {
    const response = await axios.post(apiUrl, loaded.data, {
      headers: headers,
      timeout: timeoutMs,
      // ★ 绝不走 HTTP 代理：MMABridge 是本机 / 局域网内的服务，
      //   而 axios 会读 HTTP_PROXY / http_proxy 环境变量 —— 一旦命中代理
      //   （Steam++ / clash / 公司代理等），请求会被绕到代理进程上，本机直连反而失败。
      //   这里显式关掉，保证「连本机 / 连局域网」永远直连。
      proxy: false,
      // 非 2xx 也自己处理，保证把服务端信封原样打印出来
      validateStatus: function () {
        return true;
      },
    });

    // 响应信封原样打印（方便脚本 JSON.parse）
    console.log(JSON.stringify(response.data, null, 2));

    // 局域网鉴权失败：补一句人能直接照做的提示
    // （信封本身已经打印在上面了，这里只补「怎么办」）
    if (response.data && response.data.code === "UNAUTHORIZED") {
      console.error(
        "[ERROR] 局域网访问需要在 App 设置 → MMABridge 中复制 Token，并用 --token 或 MMA_BRIDGE_TOKEN 传入"
      );
    }

    if (response.status < 200 || response.status >= 300) {
      console.error(
        "[ERROR] API request failed with HTTP status " + response.status + " (response body above)"
      );
      process.exit(1);
    }

    // 业务失败：success:false → 退出码 1（CLI 2.0 约定）
    if (!response.data || response.data.success !== true) {
      process.exit(1);
    }
  } catch (error) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      console.error("[ERROR] API request timed out after " + timeoutMs + "ms");
      console.error("[ERROR] The server may still be processing this request.");
    } else if (error.response) {
      console.error("[ERROR] API request failed with HTTP status " + error.response.status);
      if (error.response.data !== undefined) {
        console.log(JSON.stringify(error.response.data, null, 2));
      }
    } else if (error.request) {
      console.error("[ERROR] No response received from API");
      console.error(
        "[ERROR] Please make sure Meteor Master AI is running with MMABridge enabled on http://" +
          parsed.host +
          ":" +
          parsed.port
      );
    } else {
      console.error("[ERROR] Request setup error: " + error.message);
    }
    process.exit(1);
  }
}

/**
 * 处理 list 命令：列出所有运行中的实例端口
 * 探活失败只提示、不删实例文件（避免误删正在启动/重启的实例）
 */
async function handleList() {
  infoLog("[INFO] Executing list command...");

  const registryDir = getRegistryDir();
  infoLog("[INFO] Registry directory: " + registryDir);

  let files = [];
  try {
    files = fs.readdirSync(registryDir);
  } catch (error) {
    if (error.code === "ENOENT") {
      // 首次运行还没起过 App：目录不存在是正常情况
      infoLog("[INFO] Registry directory does not exist. No instances found.");
    } else {
      console.error("[ERROR] Failed to read registry directory: " + error.message);
      process.exit(1);
    }
  }

  const instanceFiles = [];
  for (let i = 0; i < files.length; i++) {
    if (/^instance-\d+\.json$/.test(files[i])) {
      instanceFiles.push(files[i]);
    }
  }
  infoLog("[INFO] Found " + instanceFiles.length + " instance files");

  const validPorts = [];

  for (let i = 0; i < instanceFiles.length; i++) {
    const file = instanceFiles[i];
    const match = file.match(/^instance-(\d+)\.json$/);
    if (!match) {
      continue;
    }
    const port = parseInt(match[1], 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      infoLog("[WARN] Skip invalid instance file name: " + file);
      continue;
    }

    try {
      infoLog("[INFO] Checking health for port " + port + "...");
      const response = await axios.post(
        "http://127.0.0.1:" + port + "/health",
        {},
        {
          headers: {
            "Content-Type": "application/json",
            "X-MMA-Bridge": "mma-bridge/" + MMA_BRIDGE_VERSION,
            "X-MMA-Skill": SKILL_VERSION,
          },
          timeout: HEALTH_TIMEOUT_MS,
          validateStatus: function () {
            return true;
          },
        }
      );

      const isHealthy =
        response.status >= 200 &&
        response.status < 300 &&
        response.data &&
        response.data.success === true;

      if (isHealthy) {
        infoLog("[INFO] Instance on port " + port + " is healthy");
        validPorts.push(port);
      } else {
        infoLog(
          "[WARN] Instance on port " + port + " returned invalid health response (kept instance file)"
        );
      }
    } catch (error) {
      infoLog(
        "[WARN] Instance on port " + port + " is not responding: " + error.message
      );
      infoLog("[WARN] Kept instance file (not deleted): " + file);
    }
  }

  validPorts.sort(function (a, b) {
    return a - b;
  });
  console.log("\nValid ports: " + validPorts.join(" "));
}

/**
 * 初始化日志会话（仅实际执行命令时调用）
 */
function beginLogSession(command, args) {
  logManager = new LogManager(getLogDir());
  logManager.begin(command, args);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    console.error("\n[ERROR] No command specified.");
    process.exit(1);
  }

  const first = args[0].toLowerCase();

  // --help / --version：不创建日志会话、不写日志文件
  if (first === "--help" || first === "-h" || first === "help") {
    printHelp();
    return;
  }
  if (first === "--version" || first === "-v" || first === "version") {
    console.log(MMA_BRIDGE_VERSION);
    return;
  }

  const command = first;
  beginLogSession(command, args.slice(1));

  try {
    switch (command) {
      case "start":
        handleStart();
        break;
      case "check":
        handleCheck();
        break;
      case "post":
        await handlePost(args.slice(1));
        break;
      case "list":
        await handleList();
        break;
      default:
        console.error("[ERROR] Unknown command: " + command);
        printHelp();
        process.exitCode = 1;
    }
  } finally {
    if (logManager) {
      logManager.end();
    }
  }
}

// 确保程序退出时关闭日志流
process.on("exit", function () {
  if (logManager) {
    logManager.end();
  }
});

// 处理未捕获的异常
process.on("uncaughtException", function (error) {
  console.error("[ERROR] Uncaught Exception:", error);
  if (logManager) {
    logManager.end();
  }
  process.exit(1);
});

// 处理未处理的 Promise 拒绝
process.on("unhandledRejection", function (reason) {
  console.error("[ERROR] Unhandled Rejection:", reason);
  if (logManager) {
    logManager.end();
  }
  process.exit(1);
});

main().catch(function (error) {
  console.error("[ERROR] Fatal error:", error);
  process.exit(1);
});
