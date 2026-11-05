# mma-bridge

Meteor Master AI Launcher & CLI - launch Meteor Master AI and call its local MMABridge API from the command line on Windows and macOS.

**Version 2.0.0** · Requires **Meteor Master AI ≥ 5.15.0** (v2 MMABridge protocol).

**About MeteorMaster**: MeteorMaster is a powerful meteor detection and analysis tool. Visit the official website: https://photohelper.cn/meteormaster

## Agent integration (OpenClaw skill)

mma-bridge is designed for OpenClaw and similar AI agent systems. The recommended integration path is to install the matching skill as well:

- Skill page (install command, API docs): **https://clawhub.ai/mordom0404/skills/mma-bridge**
- Install the skill: `openclaw skills install @mordom0404/mma-bridge`

The skill carries the version requirements, the first-run self-check below, and the documentation for all 15 API methods.

[English Version](https://github.com/mordom0404/mma-bridge/blob/master/README.md) | [中文版本文档](https://github.com/mordom0404/mma-bridge/blob/master/README.zh-CN.md)

## Requirements

| Component | Required | Notes |
|---|---|---|
| Meteor Master AI (the App) | **≥ 5.15.0** | The v2 MMABridge protocol starts at App 5.15.0. Older Apps ship the v1 bridge, which this CLI does not support (see “Talking to an old App”). |
| mma-bridge (this CLI) | **≥ 2.0.0** | Every request carries the `X-MMA-Bridge: mma-bridge/<version>` and `X-MMA-Skill: 2.0.0` headers, which the App validates. |
| Node.js | ≥ 14 | |

How to check the App version: it is displayed in the App's **main title bar**, right next to `Meteor Master AI` (e.g. `5.15.0`), or returned by `getCurrentInfo` as `data.appVersion`. If your store's latest version is still below 5.15.0, update the App first.

## Installation

```bash
# Pin the version and verify afterwards. A bare `npm install -g mma-bridge` silently installs an
# old 1.x release if npm's `latest` tag is stale — every `mma post` would then be rejected with
# OUTDATED_CLI.
npm install -g mma-bridge@2.0.0
mma --version   # must print 2.0.0 or higher
```

Upgrading an existing install:

```bash
npm install -g mma-bridge@latest
mma --version
```

## First-run self-check (new machines / agents)

Run this once before calling any business method. If a step fails, stop and see “Troubleshooting”:

1. `mma --version` → must be `2.0.0` or higher.
2. `mma check` → confirms Meteor Master AI is installed. If it is not, install the App from the Microsoft Store / App Store first.
3. `mma start` if the App is not running.
4. `mma list` → wait until it prints `Valid ports:`. The bridge port may need **1–10 seconds** after launch, so retry once per second up to 10 times.
5. `mma post --method getCurrentInfo` → verify all three:
   - `data.bridgeProtocolVersion === "2.0.0"`;
   - `data.appVersion` ≥ `5.15.0`;
   - `data.supportMMABridgeMethods` contains all **15 methods** (including `adjustResult` / `addResult`).

Only after these checks should you call business methods.

## ⚠️ Breaking changes in 2.0.0

mma-bridge 2.0.0 speaks the **v2 MMABridge protocol** and is **not compatible with 1.x**:

- Every `post`/`list` request carries the version headers `X-MMA-Bridge: mma-bridge/2.0.0` and `X-MMA-Skill: 2.0.0`. The App validates them: an old CLI (1.x) is rejected with `OUTDATED_CLI` / `OUTDATED_SKILL`.
- API responses use the v2 envelope: `{ "success": true, "message": "...", "data": ... }` on success and `{ "success": false, "code": "...", "message": "...", "data": null }` on business failure. Business failures still return HTTP 200.
- `mma post` exits with code **1** when `success:false` (the JSON response is still printed to stdout), and with code 1 on network/HTTP errors.
- The hidden `--data` option was **removed**. Use `--data-file <path>` only.
- `mma list` no longer deletes instance files that fail the health check; it only warns and keeps them.
- CLI logs moved out of the instance-registry directory to `%TEMP%/MeteorMasterAI/mma-bridge-logs/` (see “Logs”).

### Talking to an old App (< 5.15.0)

The v1 bridge (App 5.14.x and earlier) is **not version-gated**: it ignores the version headers, so requests may still “succeed” — but the contract is different:

- the response envelope has **no `code` field**;
- business failures are still reported as `success: true`, with the error text inside `data` (so `success` cannot be trusted);
- `getCurrentInfo` has **no `bridgeProtocolVersion` / `minCliVersion` / `minSkillVersion`**, and `supportMMABridgeMethods` lists only 13 methods;
- `adjustResult` / `addResult` do not exist and return `{success:false, message:"Request timeout or invalid request url"}` after ~5 seconds (again without `code`).

Any of the above means **the App is too old**: ask the user to update Meteor Master AI to 5.15.0+ instead of retrying.

## Usage

### Check if Meteor Master AI is installed

```bash
mma check
```

Exits with code 1 if Meteor Master AI is not installed.

### Launch Meteor Master AI

```bash
mma start
```

### List Running Instances

```bash
mma list
```

This command will:
1. Read instance files from `%TEMP%/MeteorMasterAI/mma-bridge-registry/`
2. Check each instance's health with `POST /health` (3 second timeout)
3. **Keep** instance files that fail the health check (they are only reported as warnings — never deleted, so a starting/restarting App is not lost)
4. Print `Valid ports:` followed by the healthy ports

Example output:

```text
Valid ports: 9000 9002
```

### Send API Requests

> ⚠️ **Important**: Meteor Master AI only allows interaction through the `mma` command. Direct HTTP requests are not supported. This is the only official way to communicate with Meteor Master AI.

```bash
mma post --method <methodName> [--port <port>] [--host <host>] [--token <token>] [--data-file <filePath>]
```

Parameters:
- `--method`: **Required**, the API method name (15 methods, see the skill documentation `skill/references/api_spec.md`)
- `--port`: Optional, API server port, integer **1–65535**, default **9000**. If several instances are running, find their ports with `mma list` first and pass `--port`
- `--host`: Optional, the IP (or host name) of the machine running Meteor Master AI, default **127.0.0.1**. Only needed when calling from **another device** while the App has "Allow LAN access" enabled
- `--token`: Optional, the LAN access token. Can also be supplied via the `MMA_BRIDGE_TOKEN` environment variable (the command line wins). Copy the token from the App's *Settings → MMABridge → Allow LAN access*
- `--data-file`: **Optional**, path to a JSON **object** request body file. **Omitted means `{}`**. The body must not contain a `uuid` field (the server injects it)

The response is printed to stdout as JSON. `success:false` → exit code 1.

> **No token needed for local calls**: the App only requires a token from **non-local** sources, so calling `127.0.0.1` from the same machine keeps working unchanged.

#### Usage

```bash
# No body needed (--data-file can be omitted)
mma post --method getCurrentInfo

# With a JSON body file
echo '{"orderBy":0,"sort":"DESC","pageSize":10,"pageIndex":1}' > data.json
mma post --method getDataList --data-file data.json --port 9000
```

#### Examples

```bash
# Get current info (default port 9000)
mma post --method getCurrentInfo

# Specify a custom port
mma post --method getCurrentInfo --port 9000

# Full example
echo '{"id":"12345"}' > data.json
mma post --method getDataDetail --port 9000 --data-file data.json
```

### LAN Access

After enabling "Allow LAN access" in the App's *Settings → MMABridge*, other devices on the same LAN can call it:

```bash
# From another device (App machine IP + token)
mma post --method getCurrentInfo --host 192.168.0.113 --port 9000 --token <token>

# Or pass the token through the environment
export MMA_BRIDGE_TOKEN=<token>
mma post --method getCurrentInfo --host 192.168.0.113 --port 9000
```

Notes:

- The token is shown in plain text in the App settings; copy it and pass it via `--token` or `MMA_BRIDGE_TOKEN`;
- A missing or wrong token → HTTP **401** with an `UNAUTHORIZED` envelope, CLI exit code **1**, plus an extra hint line telling you where to get the token;
- While the App only listens on `127.0.0.1`, other devices **cannot** connect — "Allow LAN access" must be enabled first;
- `mma list` always discovers **local** instances only (it reads the instance files in the local temp directory) and does not accept `--host`;
- The port drifts within 9000–10000, so a port saved on another device may go stale — check the current port with `mma list` or the App settings;
- Browsers cannot call the API directly: the server rejects requests carrying an `Origin` header (DNS rebinding / CSRF protection).

### Help / Version

```bash
mma --help
mma --version
```

`--version` prints the CLI version (`2.0.0`). Neither command creates a log session.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `OUTDATED_CLI` / `OUTDATED_SKILL` | The CLI (or the skill) is older than 2.0.0 | `npm install -g mma-bridge@latest` and verify with `mma --version`; update the skill with `openclaw skills install @mordom0404/mma-bridge` |
| `mma list` prints no `Valid ports:` | App not running / MMABridge disabled / port not ready yet | `mma start`; enable *Settings → General → MMABridge*; retry `mma list` |
| `ECONNREFUSED` | App not running, or MMABridge disabled | `mma start` and enable the switch |
| `success:true` but the body contains an error string, or the envelope has no `code`, or `getCurrentInfo` lacks `bridgeProtocolVersion` | App < 5.15.0 (v1 bridge) | Update the App to 5.15.0+ (see “Talking to an old App”) |
| `Request timeout or invalid request url` after ~5s, no `code` | v1 App (method does not exist) or a wrong method name | Check the App version; method names are case-sensitive (15 methods) |
| HTTP 401 + `UNAUTHORIZED` | Missing/wrong LAN token, or the request carries an `Origin` header | Copy the token from *Settings → MMABridge → Allow LAN access* and pass `--token` / `MMA_BRIDGE_TOKEN`; browsers cannot call the API |
| `ETIMEDOUT` (~21s) / `EHOSTUNREACH` | The connection was silently dropped (firewall) / host offline or wrong IP | Allow the App through the firewall / check the IP |
| A saved port stopped working | The bridge port drifts within 9000–10000 | Re-check the current port with `mma list` or the App settings |

## Logs

CLI logs are written to `%TEMP%/MeteorMasterAI/mma-bridge-logs/` (`log-<timestamp>.log`), **not** into the instance-registry directory, so they never interfere with `mma list` instance discovery.

- One log file is created per **actual command run** (`start` / `check` / `post` / `list`).
- `mma --help` and `mma --version` do **not** create a log file (they exit before the log session starts).

Retention is applied at the start of each session: at most **30** log files **including the current session's file**, and at most **7 days**; older files are deleted automatically.

## How It Works

### Windows

1. Check if Meteor Master AI is installed using PowerShell's `Get-StartApps` command
2. If installed, extract the AppID
3. Launch the application using `explorer.exe shell:{AppID}`

### macOS

1. Check if Meteor Master AI is installed using `mdfind -name "Meteor Master AI.app"`
2. If installed, launch the application using `open -a "Meteor Master AI"`

## Debugging

The program includes detailed console output for debugging, and every actual command run (`start` / `check` / `post` / `list`) is logged to `%TEMP%/MeteorMasterAI/mma-bridge-logs/`. You can also run the CLI directly:

```bash
node node_modules/mma-bridge/src/cli.js post --method getCurrentInfo
```

## Development

```bash
# Clone the repository
git clone https://github.com/mordom0404/mma-bridge.git
cd mma-bridge

# Install dependencies
npm install

# Local testing
npm link
mma --version
```

## License

MIT
