# mma-bridge

Meteor Master AI 启动器 - 通过命令行快速启动微软商店中的 Meteor Master AI 应用。

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

## 工作原理

1. 通过 PowerShell 的 `Get-StartApps` 命令检查系统是否安装了 Meteor Master AI
2. 如果已安装，提取应用的 AppID
3. 使用 `explorer.exe shell:{AppID}` 格式启动应用

## 调试

程序包含详细的 console.log 输出，方便调试。可以通过以下方式查看详细日志：

```bash
node node_modules/mma-bridge/src/cli.js start
```

## 开发

```bash
# 克隆项目
git clone <repository-url>
cd mma-bridge

# 安装依赖
npm install

# 本地测试
npm link
mma-bridge start
```

## 许可证

MIT
