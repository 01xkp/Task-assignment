# 运行与维护

本文面向 Windows PowerShell 环境，说明开发启动、Codex 后台进程停止、生产运行、局域网访问、数据备份和常见故障处理。

## 1. 运行前检查

环境要求：

- Windows 10/11 或 Windows Server。
- Node.js 20.19 或更高版本。
- 能访问 `.env.local` 中配置的 OpenAI 兼容网关。
- 局域网访问时，运行电脑和访问设备位于同一网络且没有 AP 隔离。

在项目根目录检查版本并安装依赖：

```powershell
node --version
npm --version
npm install
```

首次运行时创建本地配置：

```powershell
Copy-Item .env.example .env.local
```

编辑 `.env.local` 并填写 `OPENAI_API_KEY`。该文件已被 Git 忽略，不要把真实密钥粘贴到 README、源码、提交记录或聊天截图中。

## 2. 开发模式运行

在项目根目录执行：

```powershell
npm run dev
```

这个命令同时启动两个进程：

| 服务 | 监听地址 | 用途 |
| --- | --- | --- |
| Vite 前端 | `0.0.0.0:5173` | 页面、热更新，并把 `/api` 代理到本机 `5174` |
| Express API | `0.0.0.0:5174` | 文档解析、本地数据、模型请求和生产静态页面 |

本机访问：

- 页面：`http://localhost:5173`
- API 健康检查：`http://localhost:5174/api/health`

终端出现以下两类信息说明启动成功：

```text
VITE ready
DevFlow API listening on http://0.0.0.0:5174
```

开发模式下保持当前 PowerShell 窗口打开。修改 Vue 或服务端文件后会自动刷新或重启。

### 分别启动前端与 API

需要单独调试时，打开两个 PowerShell 窗口：

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

只启动前端时，上传、知识库和模型分析会因为 `5174` 未运行而失败。

### PRD 导入

普通文件可导入 PDF、DOCX、Markdown、TXT 和 JSON。也可递归选择文件夹中的 Markdown 文件，或上传包含 Markdown 的 ZIP 包；文件夹层级会保留为导入来源路径。

- 文件夹选择依赖浏览器的目录选择能力；当前界面只会在浏览器支持时显示该入口，不支持时可逐个选择 Markdown 文件或导入 ZIP 包。
- 每个上传文件（包括 ZIP）最大为 10MB；普通文件和 ZIP 中的 Markdown 条目共用一次请求最多 100 份 PRD 文档的额度。
- ZIP 只会读取其中嵌套的 Markdown 文件，其他文件不会导入；每份 ZIP Markdown 解压后最大为 10MB，全部 ZIP Markdown 解压后的总内容最大为 50MB。
- ZIP 无法读取或不含 Markdown 时会显示导入失败，但已选择的有效普通文件仍会继续导入。

## 3. 停止开发服务

### 当前窗口前台运行

在执行 `npm run dev` 的 PowerShell 窗口按：

```text
Ctrl+C
```

如果终端询问是否终止批处理任务，输入 `Y` 并回车。

### Codex 或其他工具在后台启动

在项目根目录新开 PowerShell，执行：

```powershell
npm run stop:dev
```

该脚本会定位本工程的 `concurrently` 进程，并按子进程到父进程的顺序停止 Vite、Express、`node --watch` 和协调进程。不要只杀掉当前监听 `5174` 的 Node 子进程，否则 `node --watch` 可能立即重新拉起它。

检查是否已经停止：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5173,5174 -ErrorAction SilentlyContinue
```

没有输出表示两个开发端口均已释放。

### 手动查看占用进程

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5173,5174 |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

根据上一步的 `OwningProcess` 查看进程详情：

```powershell
Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" |
  Select-Object ProcessId,ParentProcessId,Name,CommandLine
```

优先使用 `npm run stop:dev`。只有确认 PID 属于本工程后，才使用 `Stop-Process -Id <PID> -Force`。

## 4. 后台启动

需要关闭当前终端后仍继续运行开发服务时，可以在 PowerShell 中执行：

```powershell
Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run","dev" `
  -WorkingDirectory "D:\xkp\Task-assignment" `
  -RedirectStandardOutput "D:\xkp\Task-assignment\devflow-dev.log" `
  -RedirectStandardError "D:\xkp\Task-assignment\devflow-dev.error.log" `
  -WindowStyle Hidden
```

查看后台日志：

```powershell
Get-Content .\devflow-dev.log -Tail 80
Get-Content .\devflow-dev.error.log -Tail 80
```

停止后台服务仍然使用：

```powershell
npm run stop:dev
```

## 5. 局域网访问

### 查找运行电脑的 IPv4 地址

```powershell
Get-NetIPConfiguration |
  Where-Object { $_.IPv4DefaultGateway } |
  Select-Object InterfaceAlias,@{Name='IPv4';Expression={$_.IPv4Address.IPAddress}}
```

也可以执行 `ipconfig`，查看当前 Wi-Fi 或以太网适配器的 IPv4 地址。不要使用 `127.0.0.1`、虚拟机网卡、VPN 网卡或 `169.254.x.x` 地址。

假设运行电脑地址为 `192.168.0.121`：

| 模式 | 其他设备访问地址 |
| --- | --- |
| 开发模式 | `http://192.168.0.121:5173` |
| 开发 API 检查 | `http://192.168.0.121:5174/api/health` |
| 生产模式 | `http://192.168.0.121:5174` |

本工程已将 Vite 和 Express 监听地址配置为 `0.0.0.0`，因此不需要再添加 `--host` 参数。

### 配置 Windows 防火墙

以管理员身份打开 PowerShell。开发环境需要允许 `5173`；若要从其他设备直接访问健康检查，再允许 `5174`：

```powershell
New-NetFirewallRule `
  -DisplayName "DevFlow LAN" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 5173,5174 `
  -RemoteAddress LocalSubnet
```

查看规则：

```powershell
Get-NetFirewallRule -DisplayName "DevFlow LAN"
```

不再需要局域网访问时可删除该规则：

```powershell
Remove-NetFirewallRule -DisplayName "DevFlow LAN"
```

该规则只允许本地子网，不要把开发端口映射到公网路由器。当前应用没有登录和权限系统，不适合直接暴露到互联网。

### 从另一台设备逐层检查

1. 在运行电脑打开 `http://localhost:5173`。
2. 在运行电脑打开 `http://<IPv4>:5173`。
3. 在另一台设备打开 `http://<IPv4>:5174/api/health`。
4. 健康检查成功后，再打开 `http://<IPv4>:5173`。

如果第 1 步失败，检查服务是否启动；第 2 步失败，检查监听地址；第 3 步失败，检查防火墙、网络类型、VPN 和路由器 AP 隔离；健康检查成功但页面 API 失败，检查 Vite 代理和 `5174` 服务。

访客 Wi-Fi、企业无线客户端隔离、部分手机热点和 VPN 会阻止同一网络中的设备互访。此时即使防火墙规则正确，也需要更换网络或关闭隔离设置。

## 6. 生产模式运行

本节说明 Windows 上的本地生产运行。Ubuntu KVM 的生产部署请参阅 [Ubuntu KVM 生产部署](deployment-kvm-ubuntu.md)。

构建并启动：

```powershell
npm run build
npm start
```

生产模式由 Express 在 `5174` 同时提供 API 和 `dist` 前端：

- 本机：`http://localhost:5174`
- 局域网：`http://<IPv4>:5174`

生产模式不需要 `5173`。Vue 代码变化后必须重新执行 `npm run build`，然后重启 `npm start`。

`npm run stop:dev` 主要用于开发模式。生产服务在前台运行时按 `Ctrl+C`；若由 Windows 服务、PM2 或部署平台托管，应使用对应管理工具停止。

## 7. 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 空 | 必填，只保存在 `.env.local` |
| `OPENAI_BASE_URL` | `https://api.openai.com` | OpenAI 兼容网关根地址，可带或不带 `/v1` |
| `OPENAI_MODEL` | `gpt-5.6-sol` | 任务拆分与方案复核共用的模型 |
| `OPENAI_REASONING_EFFORT` | `xhigh` | 服务端统一推理强度，页面不提供按次选择 |
| `OPENAI_DISABLE_RESPONSE_STORAGE` | `true` | 为 `true` 时发送 `store: false` |
| `OPENAI_REQUEST_TIMEOUT_MS` | `360000` | 单次模型请求超时；启用方案复核时包含两次串行请求 |
| `PORT` | `5174` | Express API 和生产前端端口 |
| `DEVFLOW_HOST` | `0.0.0.0` | Express 监听地址；局域网访问需要保持此值 |

修改 `.env.local` 后必须重启 API。页面不提供模型切换，任务拆分和方案复核始终使用 `OPENAI_MODEL`；`OPENAI_REASONING_EFFORT` 也由服务端统一控制。

如果修改 `PORT`，还要同步修改 `vite.config.js` 中 `/api` 的代理目标，并调整防火墙规则和访问地址。

## 8. 数据备份与恢复

本地工作区位于 `data/workspace.json`。备份前先停止写入或停止服务：

```powershell
Copy-Item data\workspace.json data\workspace.backup.json
```

恢复步骤：

1. 停止服务。
2. 再备份一次当前 `data/workspace.json`。
3. 确认备份文件来源正确。
4. 用目标备份替换 `data/workspace.json`。
5. 重新启动并检查 PRD、任务和知识数量。

两类页面删除行为不同：

- 删除 PRD：删除该 PRD 和关联任务，历史调整知识继续保留。
- 删除知识：只删除选中的历史知识，已有 PRD 和任务不变，未来模型不再检索该记录。

## 9. 模型耗时说明

完整分析由任务拆分和可选方案复核组成；两次请求都使用 `OPENAI_MODEL`，并按顺序执行。较高推理强度、大型 PRD、较多任务、网关排队和 JSON Schema 降级重试都会增加总耗时。`OPENAI_REQUEST_TIMEOUT_MS` 是单次请求超时，不是整个分析流程的总超时。

页面进度含义：

- 长时间停在“任务拆分”：环境配置的模型仍在推理、排队或尚未返回流式文本。
- 进入“方案复核”后变慢：首轮已完成，耗时发生在第二次请求。
- 每 10 秒有心跳但输出字符不增长：浏览器与本地 API 正常，正在等待上游网关。

浏览器为需求拆分和方案复核分别设置“单次超时加 30 秒缓冲”的截止时间，只有收到进入复核的进度事件才会开始第二个窗口；服务端也设置整体截止时间，并在浏览器断开时中止上游请求。因此，模型服务未返回时会显示可重试错误，不会无限停在同一进度。

缩短分析时间的顺序：

1. 在 `.env.local` 配置响应更快的 `OPENAI_MODEL` 并重启 API。
2. 导入后关闭“方案复核”。
3. 在 `.env.local` 调低 `OPENAI_REASONING_EFFORT` 并重启 API。
4. 精简 PRD 中与客户端任务无关的长附录。

## 10. 常见故障

### `5173` 能打开，但操作提示 API 失败

检查 `5174` 是否监听：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5174
Invoke-RestMethod http://localhost:5174/api/health
```

开发页面的 `/api` 请求通过 Vite 代理到 `localhost:5174`。API 未运行时，页面本身仍可能打开，但上传、删除和任务分配都会失败。

### 端口已被占用

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5173,5174 |
  Select-Object LocalPort,OwningProcess
```

确认占用者后停止旧的 DevFlow 服务。Vite 使用 `strictPort: true`，不会自动换到另一个端口。

### 502 或返回 HTML

这通常来自 `OPENAI_BASE_URL` 指向的上游网关，而不是 Vue 页面。先检查 `/api/health`，再检查网关可用性、模型名称和网关日志。

### 504 或模型超时

提高 `OPENAI_REQUEST_TIMEOUT_MS` 只会延长等待，不会提升模型速度。优先修改 `OPENAI_MODEL`、关闭方案复核或降低服务端统一推理强度。

### 配置模型与网关返回不一致

分析结果会保存 `OPENAI_MODEL` 请求值和网关实际返回模型。PRD 列表中的“网关已验证”来自 Responses API 返回的 `model` 字段；二者不同时，应检查兼容网关是否进行了模型别名或路由转换。

### 知识删除失败后其他写操作报相同错误

当前版本的写入队列会在失败后自动恢复。若旧页面仍显示历史错误，刷新页面；如果服务未热更新，停止并重新执行 `npm run dev`。
