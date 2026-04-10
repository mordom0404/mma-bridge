# mma-bridge

Meteor Master AI Launcher - Quickly launch Meteor Master AI from the command line on Windows and macOS.

**About MeteorMaster**: MeteorMaster is a powerful meteor detection and analysis tool. Visit the official website: https://photohelper.cn/meteormaster

[English Version](https://github.com/mordom0404/mma-bridge/blob/master/README.md) | [中文版本文档](https://github.com/mordom0404/mma-bridge/blob/master/README.zh-CN.md)

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

### List Running Instances

Use the `list` command to view all running Meteor Master AI instances:

```bash
mma list
```

This command will:
1. Check the system's temporary directory for instance files
2. Verify the health status of each instance
3. Remove invalid instance files
4. Return a list of valid instance ports

Example output:
```json
[
  9000,
  9001
]
```

### Send API Requests

> ⚠️ **Important**: Meteor Master AI only allows interaction through the `mma` command. Direct HTTP requests are not supported. This is the only official way to communicate with Meteor Master AI.

Use the `post` command to send requests to the local API and get responses:

```bash
mma post --method <methodName> [--port <port>] [--data-file <filePath>]
```

Parameters:
- `--method`: Required, specifies the API method name
- `--port`: Optional, specifies the port number, defaults to 9000
- `--data-file`: Optional, specifies the path to a JSON file containing request body data

#### Usage

```bash
# Step 1: Save JSON data to a file
echo '{"pageIndex":0,"pageSize":10,"orderBy":2,"sort":"DESC","date":"2025-12-31"}' > data.json

# Step 2: Use --data-file to pass the data
mma post --method getDataList --data-file data.json --port 9000
```

#### Examples

```bash
# Get current info (using default port 9000)
mma post --method getCurrentInfo

# Specify custom port
mma post --method getCurrentInfo --port 9000

# Use data-file to pass JSON data
mma post --method someMethod --data-file data.json

# Full example
mma post --method getCurrentInfo --port 9000 --data-file data.json
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
mma start
```

## 许可证

MIT
