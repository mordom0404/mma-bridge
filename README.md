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

Use the `post` command to send requests to the local API and get responses:

```bash
mma post --method <methodName> [--port <port>] [--data '<json>']
```

Parameters:
- `--method`: Required, specifies the API method name
- `--port`: Optional, specifies the port number, defaults to 9000
- `--data`: Optional, specifies JSON data for the request body

#### ⚠️ Important: Escaping Characters in JSON Data

When passing JSON data in Windows Command Prompt (CMD), **you must use escape characters** for double quotes. This is because the command line argument parser removes the outer quotes, causing JSON format errors.

**Correct usage:**

```bash
# Windows CMD - Use escaped double quotes
mma post --method getDataList --data "{\"pageIndex\":0,\"pageSize\":10,\"orderBy\":2,\"sort\":\"DESC\",\"date\":\"2025-12-31\"}" --port 9000
```

**Important notes:**

1. All double quotes in JSON strings must be escaped with `\`
2. Wrap the entire JSON string with double quotes
3. Do not use single quotes to wrap JSON strings (this may work in some shells but not in CMD)

#### Examples

```bash
# Get current info (using default port 9000)
mma post --method getCurrentInfo

# Specify custom port
mma post --method getCurrentInfo --port 9000

# With JSON data (note escaped quotes)
mma post --method someMethod --data "{\"key\": \"value\"}"

# Full example (note escaped quotes)
mma post --method getCurrentInfo --port 9000 --data "{\"param1\": \"value1\"}"
```

This command sends a POST request to `http://127.0.0.1:<port>/api/<methodName>` and returns the response in JSON format.

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
