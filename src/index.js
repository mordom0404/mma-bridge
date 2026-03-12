const { execSync } = require("child_process");
const path = require("path");

/**
 * 检查用户电脑上是否安装了 Meteor Master AI
 * @returns {Object} { exists: boolean, AppID?: string }
 */
function checkMeteorMasterAI() {
  console.log("[DEBUG] 正在检查 Meteor Master AI 是否安装...");

  try {
    // 运行 PowerShell 命令获取应用信息
    const command =
      "powershell -Command \"Get-StartApps | Where-Object {$_.Name -like '*Meteor Master AI*'} | Format-List\"";

    console.log("[DEBUG] 执行命令:", command);
    const result = execSync(command, { encoding: "utf8", timeout: 10000 });

    console.log("[DEBUG] PowerShell 返回结果:");
    console.log(result);

    // 解析返回结果，提取 Name 和 AppID
    const lines = result
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    if (lines.length === 0) {
      console.log("[DEBUG] 未找到 Meteor Master AI");
      return { exists: false };
    }

    let appName = null;
    let AppID = null;

    for (const line of lines) {
      if (line.startsWith("Name :")) {
        appName = line.replace("Name :", "").trim();
        console.log("[DEBUG] 找到应用名称:", appName);
      } else if (line.startsWith("AppID :")) {
        AppID = line.replace("AppID :", "").trim();
        console.log("[DEBUG] 找到 AppID:", AppID);
      }
    }

    if (!AppID) {
      console.error("[ERROR] 无法提取 AppID");
      return { exists: false };
    }

    console.log("[SUCCESS] Meteor Master AI 已安装，AppID:", AppID);
    return { exists: true, AppID };
  } catch (error) {
    console.error("[ERROR] 执行命令失败:", error.message);
    return { exists: false, error: error.message };
  }
}

/**
 * 启动 Meteor Master AI
 * @param {string} AppID - 应用的 AppID
 */
function launchMeteorMasterAI(AppID) {
  console.log("[DEBUG] 正在启动 Meteor Master AI...");
  console.log("[DEBUG] AppID:", AppID);

  try {
    // 使用 explorer.exe shell:{AppID} --value test 格式启动
    const command = `explorer.exe "shell:AppsFolder\\${AppID}"`;

    console.log("[DEBUG] 执行命令:", command);
    // 我们不需要等待 GUI 应用程序退出
    const { spawn } = require("child_process");

    spawn("explorer.exe", [`shell:AppsFolder\\${AppID}`], {
      detached: true, // 使子进程独立于父进程运行
      stdio: "ignore", // 忽略子进程的 I/O
      windowsHide: true, // 在 Windows 上隐藏子进程窗口
    }).unref(); // 释放对子进程的引用，允许父进程退出

    console.log("[SUCCESS] Meteor Master AI 启动成功");
  } catch (error) {
    console.error("[ERROR] 启动失败:", error.message);
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
      "\n[ERROR] Meteor Master AI 不存在，请先从微软商店安装该软件。\n"
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
    console.error("\n程序执行失败:", error.message);
    process.exit(1);
  });
}
