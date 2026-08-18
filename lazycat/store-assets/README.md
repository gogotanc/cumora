# Cumora store assets

## Chinese store copy

**Short description**

使用 LightOS 运行本地智能体的自托管 AI 协作工作台。

**Description**

Cumora 将对话、智能体团队与 Computer 节点集中在一个工作台中。服务端、PostgreSQL、Redis 和 pgvector 运行在懒猫微服内，Codex 或 Claude Code 等智能体引擎运行在用户自己的 LightOS Computer 上。数据保留在个人设备中，Computer 断线后可自动恢复连接。

**Usage**

1. 打开 Cumora，在 Computers 页面新增 Computer 并复制配对命令。
2. 在同一台懒猫微服的 LightOS 终端中运行该命令。
3. 确认 Computer 在线后，即可在 Cumora 中与智能体团队协作。

Cumora 当前使用懒猫微服内部 `.lzcapp` 地址连接 LightOS，不需要开放公网 API。

## Screenshots

- `screenshots/01-conversations.png`: conversation overview
- `screenshots/02-agent-team-chat.png`: multi-agent team chat
- `screenshots/03-agents.png`: four available agents on the LightOS Computer
- `screenshots/04-lightos-computer.png`: online LightOS Computer and daemon status

All screenshots are 1440x900 PNG files and contain no pairing code, token, or private credential.

## Release note

Cumora 0.1.2：首个懒猫微服版本，支持 LightOS BYOA、持久化 PostgreSQL/Redis 与 pgvector。
