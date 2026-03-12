# mma-bridge

Meteor Master AI Launcher - Quickly launch Meteor Master AI from the command line on Windows and macOS.

**About MeteorMaster**: MeteorMaster is a powerful meteor detection and analysis tool. Visit the official website: https://photohelper.cn/meteormaster

[English Version](README.md) | [中文版本文档](README.zh-CN.md)

## Installation

```bash
npm install mma-bridge
```

## Usage

### Check if Meteor Master AI is installed

```bash
mma check
```

### Launch Meteor Master AI

```bash
mma start
```

## How It Works

### Windows

1. Check if Meteor Master AI is installed using PowerShell's `Get-StartApps` command
2. If installed, extract the AppID
3. Launch the application using `explorer.exe shell:{AppID}`

### macOS

1. Check if Meteor Master AI is installed using `mdfind -name "Meteor Master AI.app"`
2. If installed, launch the application using `open -a "Meteor Master AI"`

## Debugging

The program includes detailed console.log output for debugging. You can view detailed logs by running:

```bash
node node_modules/mma-bridge/src/cli.js start
```

## Development

```bash
# Clone the repository
git clone https://github.com/mordom0404/mma-bridge.git
cd mma-bridge

# Install dependencies (currently none required)
npm install

# Local testing
npm link
mma-bridge start
```

## 许可证

MIT
