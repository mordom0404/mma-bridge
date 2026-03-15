# mma-bridge

Meteor Master AI 启动器 - 通过命令行快速启动 Windows 和 macOS 上的 Meteor Master AI 应用。

**关于 MeteorMaster**：MeteorMaster 是一款强大的流星检测与分析工具。官网：https://photohelper.cn/meteormaster

## OpenClaw 和 Agent 集成

mma-bridge 专为 OpenClaw 或类似的 AI agent 系统设计，用于快速接入 Meteor Master AI 的能力。通过 mma-bridge，agent 可以：

- 自动检测和启动 Meteor Master AI 应用
- 管理 Meteor Master AI 实例
- 通过 RESTful API 调用 Meteor Master AI 的各项功能

### 使用 Skill 集成

要充分发挥 mma-bridge 的能力，需要配合相应的 Skill 使用。完整的 Skill 实现和文档请访问：

**https://clawhub.ai/mordom0404/mma-bridge**

该 Skill 提供了：

- 预定义的 API 调用方法
- 数据处理和转换功能
- 错误处理和重试机制
- 与 OpenClaw 框架的无缝集成

通过结合 mma-bridge 和对应的 Skill，agent 可以轻松实现流星检测、数据分析和结果处理等功能。

[English Version](https://github.com/mordom0404/mma-bridge/blob/master/README.md) | [中文版本文档](https://github.com/mordom0404/mma-bridge/blob/master/README.zh-CN.md)

## 安装

```bash
npm install mma-bridge
```

## 使用

### 检查是否安装了 Meteor Master AI

```bash
mma check
```

### 启动 Meteor Master AI

```bash
mma start
```

### 列出运行中的实例的端口

使用 `list` 命令查看所有正在运行的 Meteor Master AI 实例端口：

```bash
mma list
```

该命令将执行以下操作：

1. 检查实例注册表
2. 验证每个实例的健康状态
3. 删除注册表中的无效的实例
4. 返回有效实例的端口列表

示例输出：

```json
[9000, 9001]
```

### 发送 API 请求

通过 `post` 命令向本地 API 发送请求并获取响应：

```bash
mma post --method <methodName> [--port <port>] [--data '<json>']
```

参数说明：

- `--method`: 必需，指定 API 方法名称
- `--port`: 可选，指定端口号，默认为 9000
- `--data`: 可选，指定 JSON 格式的请求体数据

#### ⚠️ 重要提示：关于 JSON 数据的转义字符

在 Windows 命令行（CMD）中传递 JSON 数据时，**必须使用转义字符**来处理双引号。这是因为命令行参数解析器会去掉外层的引号，导致 JSON 格式错误。

**正确的使用方式：**

```bash
# Windows CMD - 使用转义双引号
mma post --method getDataList --data "{\"pageIndex\":0,\"pageSize\":10,\"orderBy\":2,\"sort\":\"DESC\",\"date\":\"2025-12-31\"}" --port 9000
```

**注意事项：**

1. 所有 JSON 字符串中的双引号都需要使用 `\` 进行转义
2. 外层使用双引号包裹整个 JSON 字符串
3. 不要使用单引号包裹 JSON 字符串（在某些 shell 中可能有效，但在 CMD 中不支持）

#### 示例

```bash
# 获取当前信息（使用默认端口9000）
mma post --method getCurrentInfo

# 指定端口号
mma post --method getCurrentInfo --port 9000

# 带JSON数据（注意转义字符）
mma post --method someMethod --data "{\"key\": \"value\"}"

# 完整示例（注意转义字符）
mma post --method getCurrentInfo --port 9000 --data "{\"param1\": \"value1\"}"
```

该命令会向 `http://127.0.0.1:<port>/api/<methodName>` 发送 POST 请求，并以 JSON 格式返回响应结果。

## 工作原理

### Windows

1. 通过 PowerShell 的 `Get-StartApps` 命令检查系统是否安装了 Meteor Master AI
2. 如果已安装，提取应用的 AppID
3. 使用 `explorer.exe shell:{AppID}` 格式启动应用

### macOS

1. 使用 `mdfind -name "Meteor Master AI.app"` 检查系统是否安装了 Meteor Master AI
2. 如果已安装，使用 `open -a "Meteor Master AI"` 启动应用

## 调试

程序包含详细的 console.log 输出，方便调试。可以通过以下方式查看详细日志：

```bash
node node_modules/mma-bridge/src/cli.js start
```

## 开发

```bash
# 克隆项目
git clone https://github.com/mordom0404/mma-bridge.git
cd mma-bridge

# 安装依赖（目前不需要）
npm install

# 本地测试
npm link
mma start
```

## 许可证

MIT
