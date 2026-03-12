#!/usr/bin/env node

const { checkMeteorMasterAI, launchMeteorMasterAI } = require("./index");

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: mma <command>");
    console.log("\nAvailable commands:");
    console.log("  start     Launch Meteor Master AI");
    console.log("  check     Check if Meteor Master AI is installed");
    console.log("\nExamples:");
    console.log("  mma start");
    console.log("  mma check");
    process.exit(1);
  }

  const command = args[0].toLowerCase();

  switch (command) {
    case "start":
      handleStart();
      break;

    case "check":
      handleCheck();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log("\nAvailable commands:");
      console.log("  start     Launch Meteor Master AI");
      console.log("  check     Check if Meteor Master AI is installed");
      process.exit(1);
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

// 执行命令行解析
parseArgs();
