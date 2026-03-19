#!/usr/bin/env node

const { checkMeteorMasterAI, launchMeteorMasterAI } = require("./index");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

// 日志管理器类
class LogManager {
  constructor(registryDir) {
    this.registryDir = registryDir;
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.currentLogFile = null;
    this.currentStream = null;
    this.currentSize = 0;
    this.inSession = false; // 标记是否在会话中
    this.ensureRegistryDir();
    this.initLogFile();
  }

  // 确保registryDir存在
  ensureRegistryDir() {
    if (!fs.existsSync(this.registryDir)) {
      fs.mkdirSync(this.registryDir, { recursive: true });
    }
  }

  // 初始化日志文件
  initLogFile() {
    // 关闭之前的流
    if (this.currentStream) {
      this.currentStream.end();
    }

    // 生成新的日志文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFileName = `log-${timestamp}.log`;
    const logFilePath = path.join(this.registryDir, logFileName);

    // 创建新的写入流
    this.currentStream = fs.createWriteStream(logFilePath, { flags: "a" });
    this.currentLogFile = logFilePath;
    this.currentSize = 0;

    // 写入日志文件头
    this.writeLogHeader();
  }

  // 写入日志文件头
  writeLogHeader() {
    const header = `
========================================
MMA-Bridge Log Session
Started at: ${new Date().toISOString()}
========================================
`;
    this.write(header);
  }

  // 检查并轮转日志文件
  checkAndRotate() {
    // 如果在会话中，不进行日志轮转
    if (this.inSession) return;

    // 如果currentLogFile不存在，直接返回
    if (!this.currentLogFile) return;

    try {
      // 检查文件是否存在
      if (!fs.existsSync(this.currentLogFile)) {
        return;
      }

      const stats = fs.statSync(this.currentLogFile);
      if (stats.size >= this.maxFileSize) {
        this.initLogFile();
      }
    } catch (error) {
      console.error(`[ERROR] Failed to check log file size: ${error.message}`);
    }
  }

  // 写入日志
  write(content) {
    if (!this.currentStream) return;

    // 在写入前检查文件大小（仅在非会话状态下）
    this.checkAndRotate();

    // 写入内容
    this.currentStream.write(content);
    this.currentSize += content.length;
  }

  // 开始会话
  startSession() {
    this.inSession = true;
  }

  // 结束会话
  endSession() {
    this.inSession = false;
    // 会话结束后检查是否需要轮转
    this.checkAndRotate();
  }

  // 记录输入
  logInput(command, args) {
    const timestamp = new Date().toISOString();
    const inputLog = `
[${timestamp}] COMMAND INPUT
Command: ${command}
Arguments: ${JSON.stringify(args, null, 2)}
----------------------------------------
`;
    this.write(inputLog);
  }

  // 记录输出
  logOutput(content) {
    const timestamp = new Date().toISOString();
    const outputLog = `
[${timestamp}] ${content}
----------------------------------------
`;
    this.write(outputLog);
  }

  // 记录错误
  logError(error) {
    const timestamp = new Date().toISOString();
    const errorLog = `
[${timestamp}] ERROR
${error}
========================================
`;
    this.write(errorLog);
  }

  // 关闭日志
  close() {
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }
  }
}

// 初始化日志管理器
let logManager = null;

// 获取registryDir路径
function getRegistryDir() {
  const tempDir = os.tmpdir();
  return path.join(tempDir, "MeteorMasterAI", "mma-bridge-registry");
}

// 拦截console.log
const originalConsoleLog = console.log;
console.log = function (...args) {
  // 调用原始方法
  originalConsoleLog.apply(console, args);

  // 写入日志
  if (logManager) {
    const content = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(" ");
    logManager.logOutput(content);
  }
};

// 拦截console.error
const originalConsoleError = console.error;
console.error = function (...args) {
  // 调用原始方法
  originalConsoleError.apply(console, args);

  // 写入日志
  if (logManager) {
    const content = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(" ");
    logManager.logError(content);
  }
};

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);

  // 初始化日志管理器
  if (!logManager) {
    logManager = new LogManager(getRegistryDir());
  }

  // 记录命令输入
  if (args.length > 0) {
    logManager.logInput(args[0], args.slice(1));
  }

  if (args.length === 0) {
    console.log("Usage: mma <command> [options]");
    console.log("\nAvailable commands:");
    console.log("  start     Launch Meteor Master AI");
    console.log("  check     Check if Meteor Master AI is installed");
    console.log("  post      Send POST request to API");
    console.log("  list      List all running instances");
    console.log("\nExamples:");
    console.log("  mma start");
    console.log("  mma check");
    console.log("  mma post --method getCurrentInfo");
    console.log("  mma list");
    process.exit(1);
  }

  const command = args[0].toLowerCase();

  // 开始会话
  if (logManager) {
    logManager.startSession();
  }

  try {
    switch (command) {
      case "start":
        handleStart();
        break;

      case "check":
        handleCheck();
        break;

      case "post":
        handlePost(args.slice(1));
        break;

      case "list":
        handleList();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log("\nAvailable commands:");
        console.log("  start     Launch Meteor Master AI");
        console.log("  check     Check if Meteor Master AI is installed");
        console.log("  post      Send POST request to API");
        console.log("  list      List all running instances");
        process.exit(1);
    }
  } finally {
    // 结束会话
    if (logManager) {
      logManager.endSession();
    }
  }
}

/**
 * 处理 start 命令
 */
function handleStart() {
  console.log("[INFO] Executing start command...");

  const checkResult = checkMeteorMasterAI();

  if (!checkResult.exists) {
    console.error("\n[ERROR] Meteor Master AI is not installed.");
    console.error(
      "Please purchase and install Meteor Master AI from the app store:"
    );
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
  } else {
    console.error("\n✗ Meteor Master AI is not installed");
    console.error(
      "Please purchase and install Meteor Master AI from the app store:"
    );
    console.error("  - Windows: Microsoft Store");
    console.error("  - macOS: Mac App Store");
    console.error("\nOfficial website: https://photohelper.cn/meteormaster");
  }
}

/**
 * 处理 post 命令
 * @param {Array} args - 命令行参数数组
 */
async function handlePost(args) {
  console.log("[INFO] Executing post command...", args);

  // 解析参数
  let method = null;
  let port = 9000; // 默认端口号
  let data = {}; // 默认请求数据

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--method" && i + 1 < args.length) {
      method = args[i + 1];
    } else if (args[i] === "--port" && i + 1 < args.length) {
      port = parseInt(args[i + 1]);
    } else if (args[i] === "--data" && i + 1 < args.length) {
      let dataStr = args[i + 1];
      try {
        data = JSON.parse(dataStr);
      } catch (e) {
        try {
          dataStr = dataStr.replace(/\\/g, "");
          data = JSON.parse(dataStr);
        } catch (parseError) {
          console.error("[ERROR] Invalid JSON data in --data parameter");
          console.error(
            'Please provide valid JSON string with escaped quotes, e.g., \'{"key": "value"}\''
          );
          console.error("[DEBUG] Received data string:", dataStr);
          process.exit(1);
        }
      }

      if (data.uuid !== undefined) {
        console.error("[ERROR] The --data parameter cannot contain UUID values");
        console.error("UUIDs are not allowed in the data parameter for security reasons.");
        process.exit(1);
      }
    } else if (args[i] === "--data-file" && i + 1 < args.length) {
      const filePath = args[i + 1];
      try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        data = JSON.parse(fileContent);
      } catch (fileError) {
        if (fileError.code === "ENOENT") {
          console.error(`[ERROR] Data file not found: ${filePath}`);
        } else if (fileError instanceof SyntaxError) {
          console.error(`[ERROR] Invalid JSON in data file: ${filePath}`);
          console.error(`[DEBUG] Parse error: ${fileError.message}`);
        } else {
          console.error(`[ERROR] Failed to read data file: ${fileError.message}`);
        }
        process.exit(1);
      }

      if (data.uuid !== undefined) {
        console.error("[ERROR] The --data-file parameter cannot contain UUID values");
        console.error("UUIDs are not allowed in the data parameter for security reasons.");
        process.exit(1);
      }
    }
  }

  // 检查 --data 和 --data-file 是否同时使用
  const dataArgIndex = args.indexOf("--data");
  const dataFileArgIndex = args.indexOf("--data-file");
  if (dataArgIndex !== -1 && dataFileArgIndex !== -1) {
    console.error("[ERROR] Cannot use both --data and --data-file at the same time");
    process.exit(1);
  }

  if (!method) {
    console.error("[ERROR] --method parameter is required");
    console.error(
      "Usage: mma post --method <methodName> [--port <port>] [--data '<json>' | --data-file <filePath>]"
    );
    console.error("Example: mma post --method getCurrentInfo");
    console.error("Example: mma post --method getCurrentInfo --port 9000");
    console.error(
      'Example: mma post --method someMethod --data \'{"key": "value"}\''
    );
    console.error("Example: mma post --method someMethod --data-file data.json");
    process.exit(1);
  }

  try {
    // 构建API URL
    const apiUrl = `http://127.0.0.1:${port}/api/${method}`;
    console.log(`[INFO] Sending POST request to: ${apiUrl}`);
    console.log(`[INFO] Request data:`, JSON.stringify(data, null, 2));

    // 发送POST请求
    const response = await axios.post(apiUrl, data, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // 输出JSON格式的响应
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error(
        "[ERROR] API request failed with status:",
        error.response.status
      );
      console.error(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error("[ERROR] No response received from API");
      console.error(
        `[ERROR] Please make sure the API server is running on http://127.0.0.1:${port}`
      );
    } else {
      console.error("[ERROR] Request setup error:", error.message);
    }
    process.exit(1);
  }
}

/**
 * 处理 list 命令
 * 列出所有运行中的实例的端口
 */
async function handleList() {
  console.log("[INFO] Executing list command...");

  try {
    // 获取系统临时文件夹路径
    const tempDir = os.tmpdir();
    console.log(`[INFO] System temp directory: ${tempDir}`);

    // 构建注册表目录路径
    const registryDir = path.join(
      tempDir,
      "MeteorMasterAI",
      "mma-bridge-registry"
    );
    console.log(`[INFO] Registry directory: ${registryDir}`);

    // 检查注册表目录是否存在
    if (!fs.existsSync(registryDir)) {
      console.log(
        "[INFO] Registry directory does not exist. No instances found."
      );
      console.log(JSON.stringify([], null, 2));
      return;
    }

    // 读取目录中的所有文件
    const files = fs.readdirSync(registryDir);
    console.log(`[INFO] Found ${files.length} files in registry directory`);

    // 筛选出符合 instance-${port}.json 模式的文件
    const instanceFiles = files.filter((file) =>
      file.match(/^instance-\d+\.json$/)
    );
    console.log(`[INFO] Found ${instanceFiles.length} instance files`);

    const validInstances = [];

    // 遍历每个实例文件
    for (const file of instanceFiles) {
      // 从文件名中提取端口号
      const match = file.match(/^instance-(\d+)\.json$/);
      if (!match) continue;

      const port = parseInt(match[1]);
      const filePath = path.join(registryDir, file);

      try {
        // 尝试请求健康检查接口
        const healthUrl = `http://127.0.0.1:${port}/health`;
        console.log(`[INFO] Checking health for port ${port}...`);

        const response = await axios.post(healthUrl, { timeout: 3000 });

        // 检查响应是否为 { success: true }
        if (response.data && response.data.success === true) {
          console.log(`[INFO] Instance on port ${port} is healthy`);
          validInstances.push({ port, status: "running" });
        } else {
          console.log(
            `[WARN] Instance on port ${port} returned invalid response`
          );
          // 删除无效的实例文件
          fs.unlinkSync(filePath);
          console.log(`[INFO] Removed invalid instance file: ${file}`);
        }
      } catch (error) {
        console.log(
          `[WARN] Instance on port ${port} is not responding: ${error.message}`
        );
        // 删除无效的实例文件
        try {
          fs.unlinkSync(filePath);
          console.log(`[INFO] Removed invalid instance file: ${file}`);
        } catch (unlinkError) {
          console.error(
            `[ERROR] Failed to remove file ${file}: ${unlinkError.message}`
          );
        }
      }
    }

    // 输出有效的实例列表
    console.log("\n[INFO] Valid ports:");
    console.log(
      JSON.stringify(
        validInstances.map((instance) => instance.port),
        null,
        2
      )
    );
  } catch (error) {
    console.error("[ERROR] Failed to list instances:", error.message);
    process.exit(1);
  }
}

// 执行命令行解析

// 确保程序退出时关闭日志流
process.on("exit", () => {
  if (logManager) {
    logManager.close();
  }
});

// 处理未捕获的异常
process.on("uncaughtException", (error) => {
  console.error("[ERROR] Uncaught Exception:", error);
  if (logManager) {
    logManager.close();
  }
  process.exit(1);
});

// 处理未处理的Promise拒绝
process.on("unhandledRejection", (reason, promise) => {
  console.error("[ERROR] Unhandled Rejection at:", promise, "reason:", reason);
  if (logManager) {
    logManager.close();
  }
  process.exit(1);
});
parseArgs();
