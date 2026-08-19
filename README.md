# 分派 DevFlow

面向 Agino Flutter 多端团队的 PRD 开发任务分配平台。系统结合工程模块、平台主责、三人的全平台未完成工时和本地调整知识，使用 OpenAI Responses API 生成任务并执行可选的第二次模型复核。

## 团队分工

| 开发 | 主责平台 | 分配原则 |
| --- | --- | --- |
| 向坤朋 | Flutter Windows / Linux | 优先处理桌面生命周期、窗口、托盘、文件与权限等平台工作 |
| 曾雨秋 | Flutter Android | 优先处理 Android 生命周期、权限、媒体、Gradle 与移动端稳定性 |
| 张徐 | Flutter iOS / macOS | 优先处理 Apple 生命周期、CocoaPods、签名与 macOS 适配 |

共享 Flutter 任务不固定给平台主责人，而是按照模块能力和三人的全平台累计工时平衡分配。平台原生任务仍优先交给对应主责人。

## 功能

- 导入 PDF、DOCX、Markdown、TXT、JSON，或读取在线网页与文档直链。
- 使用 `.env.local` 的 `OPENAI_MODEL` 完成任务拆分和可选方案复核。
- 拆分共享实现、平台适配和平台验收任务，并可启用第二次方案复核。
- 展示上下文准备、任务拆分、复核、保存等实时进度，分析期间阻止关闭弹窗和重复提交。
- 支持任务状态流转、人工重分配、AI 重分配建议，以及必填的重分配原因和备注。
- 把调整原因写入本地知识库，供后续分析检索；单条知识记录可以二次确认后删除。
- 支持删除 PRD 及其关联任务；历史知识默认保留。
- 记录请求模型、网关实际返回模型、阶段耗时和 token 用量，便于定位慢请求。

## 使用流程

1. 打开应用，创建 PRD。
2. 导入文件、输入网页链接，或直接粘贴 PRD 内容。
3. 按需选择是否启用方案复核，然后提交分析。
4. 在分析弹窗中查看上下文准备、任务拆分、方案复核和保存进度。
5. 分析完成后，在任务列表更新状态、人工重分配或采纳 AI 重分配建议，并填写必要的原因和备注。

任务拆分和方案复核始终使用服务端 `.env.local` 中的 `OPENAI_MODEL`，页面不提供模型选择器；推理强度同样由服务端 `OPENAI_REASONING_EFFORT` 统一控制。

## 文档索引

- [Windows 本地开发与维护](docs/operations.md)
- [Ubuntu KVM 生产部署](docs/deployment-kvm-ubuntu.md)

## 快速启动

环境要求：Node.js 20.19 或更高版本。

```powershell
npm install
Copy-Item .env.example .env.local
```

编辑 `.env.local`，至少填写 `OPENAI_API_KEY`。真实密钥不要写入 README、源码或提交记录。

```dotenv
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://sub2api.moreuos.com
OPENAI_MODEL=gpt-5.6-terra
OPENAI_REASONING_EFFORT=high
OPENAI_DISABLE_RESPONSE_STORAGE=true
OPENAI_REQUEST_TIMEOUT_MS=360000
PORT=5174
DEVFLOW_HOST=0.0.0.0
```

启动开发环境：

```powershell
npm run dev
```

- 前端：[http://localhost:5173](http://localhost:5173)
- API 健康检查：[http://localhost:5174/api/health](http://localhost:5174/api/health)

停止开发环境：

```powershell
npm run stop:dev
```

如果服务正在当前 PowerShell 窗口前台运行，直接按 `Ctrl+C` 也可以完整停止。不要只结束 `5174` 的监听进程，因为开发模式下 `node --watch` 可能重新启动 API。

任务拆分和方案复核都使用服务端 `OPENAI_MODEL`。推理强度由 `OPENAI_REASONING_EFFORT` 统一控制；修改任一配置后需要重启 API 服务。

## 生产运行

```powershell
npm run build
npm start
```

Express 会在 `5174` 端口同时提供 API 和 `dist` 前端，访问 [http://localhost:5174](http://localhost:5174)。

完整的启动方式、Codex 后台服务停止、局域网访问、Windows 防火墙、数据备份和模型故障排查见 [运行与维护](docs/operations.md)。

## 数据与安全

- 本地数据保存在 `data/workspace.json`，包括 PRD、任务、知识记录和活动记录。
- `.env`、`.env.local`、`data/*.json` 已被 Git 忽略。
- API Key 只由 Node 服务读取，不会进入前端构建产物。
- `OPENAI_DISABLE_RESPONSE_STORAGE=true` 时，请求会发送 `store: false`。
- 删除知识记录只会阻止未来 AI 检索该记录，不会回滚或改动已有任务。
- 删除 PRD 会同时删除其关联任务，但保留已经形成的调整知识。

## 项目结构

```text
src/                         Vue 3 工作台与交互组件
src/components/              PRD、任务、知识库、弹窗和分析进度
server/index.js              Express API、SSE 进度与业务工作流
server/model.js              Responses API、结构化输出与方案复核
server/knowledge.js          本地知识检索与提示词上下文
server/documents.js          本地和在线文档解析
server/storage.js            JSON 数据持久化与开发成员配置
server/project-context.js    Agino 模块、平台与代码目录画像
data/workspace.json          本地运行数据，首次启动自动创建
docs/operations.md           启动、局域网、备份和排障说明
```

## NPM 命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 同时启动 API 和 Vite 开发服务 |
| `npm run dev:api` | 只启动 API，文件变化时自动重启 |
| `npm run dev:web` | 只启动 Vite 前端 |
| `npm run stop:dev` | Windows 下停止本工程的开发前端、API 和监视进程 |
| `npm run build` | 构建生产前端到 `dist` |
| `npm start` | 启动生产 Express 服务 |
