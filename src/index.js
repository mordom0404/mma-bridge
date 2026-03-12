const { execSync } = require("child_process");
const path = require("path");
const os = require("os");

/**
 * 检查用户电脑上是否安装了 Meteor Master AI
 * @returns {Object} { exists: boolean, AppID?: string }
 */
function checkMeteorMasterAI() {
  console.log("[DEBUG] Checking if Meteor Master AI is installed...");

  const platform = os.platform();

  if (platform === "darwin") {
    // macOS platform
    return checkMeteorMasterAIMac();
  } else if (platform === "win32") {
    // Windows platform
    return checkMeteorMasterAIWindows();
  } else {
    console.error("[ERROR] Unsupported platform:", platform);
    return { exists: false };
  }
}

/**
 * 检查 macOS 上是否安装了 Meteor Master AI
 * @returns {Object} { exists: boolean, AppID?: string }
 */
function checkMeteorMasterAIMac() {
  console.log("[DEBUG] Checking on macOS platform...");

  try {
    // 使用 mdfind 查找应用
    const command = 'mdfind -name "Meteor Master AI.app"';
    console.log("[DEBUG] Executing command:", command);

    const result = execSync(command, { encoding: "utf8", timeout: 10000 });
    console.log("[DEBUG] mdfind returned result:");
    console.log(result);

    const appPath = result.trim();

    if (!appPath) {
      console.log("[DEBUG] Meteor Master AI not found");
      return { exists: false };
    }

    console.log("[SUCCESS] Meteor Master AI is installed at:", appPath);
    return { exists: true, AppID: "Meteor Master AI" };
  } catch (error) {
    console.error("[ERROR] Command execution failed:", error.message);
    return { exists: false, error: error.message };
  }
}

/**
 * 检查 Windows 上是否安装了 Meteor Master AI
 * @returns {Object} { exists: boolean, AppID?: string }
 */
function checkMeteorMasterAIWindows() {
  console.log("[DEBUG] Checking on Windows platform...");

  try {
    // 运行 PowerShell 命令获取应用信息
    const command =
      "powershell -Command \"Get-StartApps | Where-Object {$_.Name -like '*Meteor Master AI*'} | Format-List\"";

    console.log("[DEBUG] Executing command:", command);
    const result = execSync(command, { encoding: "utf8", timeout: 10000 });

    console.log("[DEBUG] PowerShell returned result:");
    console.log(result);

    // 解析返回结果，提取 Name 和 AppID
    const lines = result
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    if (lines.length === 0) {
      console.log("[DEBUG] Meteor Master AI not found");
      return { exists: false };
    }

    let appName = null;
    let AppID = null;

    for (const line of lines) {
      if (line.startsWith("Name :")) {
        appName = line.replace("Name :", "").trim();
        console.log("[DEBUG] Found app name:", appName);
      } else if (line.startsWith("AppID :")) {
        AppID = line.replace("AppID :", "").trim();
        console.log("[DEBUG] Found AppID:", AppID);
      }
    }

    if (!AppID) {
      console.error("[ERROR] Failed to extract AppID");
      return { exists: false };
    }

    console.log("[SUCCESS] Meteor Master AI is installed, AppID:", AppID);
    return { exists: true, AppID };
  } catch (error) {
    console.error("[ERROR] Command execution failed:", error.message);
    return { exists: false, error: error.message };
  }
}

/**
 * 启动 Meteor Master AI
 * @param {string} AppID - 应用的 AppID
 */
function launchMeteorMasterAI(AppID) {
  console.log("[DEBUG] Launching Meteor Master AI...");
  console.log("[DEBUG] AppID:", AppID);

  const platform = os.platform();

  try {
    if (platform === "darwin") {
      // macOS platform
      launchMeteorMasterAIMac(AppID);
    } else if (platform === "win32") {
      // Windows platform
      launchMeteorMasterAIWindows(AppID);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log("[SUCCESS] Meteor Master AI launched successfully");
  } catch (error) {
    console.error("[ERROR] Launch failed:", error.message);
    throw error;
  }
}

/**
 * 在 macOS 上启动 Meteor Master AI
 * @param {string} appName - 应用名称
 */
function launchMeteorMasterAIMac(appName) {
  console.log("[DEBUG] Launching on macOS platform...");

  try {
    const { spawn } = require("child_process");

    // 使用 open -a 命令启动应用
    spawn("open", ["-a", appName], {
      detached: true,
      stdio: "ignore",
    }).unref();

    console.log("[SUCCESS] Meteor Master AI launched on macOS");
  } catch (error) {
    console.error("[ERROR] Failed to launch on macOS:", error.message);
    throw error;
  }
}

/**
 * 在 Windows 上启动 Meteor Master AI
 * @param {string} AppID - 应用的 AppID
 */
function launchMeteorMasterAIWindows(AppID) {
  console.log("[DEBUG] Launching on Windows platform...");

  try {
    const { spawn } = require("child_process");

    spawn("explorer.exe", [`shell:AppsFolder\\${AppID}`], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();

    console.log("[SUCCESS] Meteor Master AI launched on Windows");
  } catch (error) {
    console.error("[ERROR] Failed to launch on Windows:", error.message);
    throw error;
  }
}

/**
 * 主入口函数
 */
async function main() {
  console.log("=".repeat(50));
  console.log("mma-bridge - Meteor Master AI Launcher");
  console.log("=".repeat(50));

  const checkResult = checkMeteorMasterAI();

  if (!checkResult.exists) {
    console.error(
      "\n[ERROR] Meteor Master AI is not installed.\n"
    );
    process.exit(1);
  }

  console.log("\n");
  launchMeteorMasterAI(checkResult.AppID);
}

// 导出函数供其他模块使用
module.exports = {
  checkMeteorMasterAI,
  launchMeteorMasterAI,
};

// 如果是直接运行此文件，执行主函数
if (require.main === module) {
  main().catch((error) => {
    console.error("\nProgram execution failed:", error.message);
    process.exit(1);
  });
}
