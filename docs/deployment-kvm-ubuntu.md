# KVM Ubuntu 部署与维护

本文记录当前 KVM/libvirt NAT 网络中 Ubuntu 虚拟机的生产部署方式。应用以 systemd 服务运行，Express 在同一个端口提供 Vue 前端和 API。

## 当前环境

| 项目 | 当前值 |
| --- | --- |
| deepin KVM 宿主机 | `192.168.0.197` |
| KVM NAT 网段 | `192.168.122.0/24` |
| Ubuntu 虚拟机 | `192.168.122.243` (`huggingface-243`) |
| 部署用户 | `gutta` |
| 应用目录 | `/home/gutta/task-assignment` |
| systemd 服务 | `task-assignment.service` |
| HTTP 端口 | `5174` |

不要把 SSH 密码、私钥或 `.env.local` 内容写入本文档、提交记录或聊天截图。

## 1. 网络与 SSH 前置条件

`192.168.122.0/24` 是 libvirt 的 NAT 内部网段，Windows 需要经由 deepin 宿主机路由到虚拟机。以管理员身份打开 Windows PowerShell，添加永久路由：

```powershell
route -p add 192.168.122.0 mask 255.255.255.0 192.168.0.197
```

deepin 宿主机必须已启用 IPv4 转发，并允许 `wlp2s0` 与 `virbr0` 间的转发。具体规则见宿主机的 KVM/libvirt 网络维护文档。确认路由后，从 Windows 检查虚拟机：

```powershell
ping 192.168.122.243
ssh gutta@192.168.122.243
```

部署前建议添加专用公钥，避免在自动化命令中使用密码：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
printf '%s\n' 'ssh-ed25519 <deployment-public-key> task-assignment@deployment-host' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

以上命令必须在 **Ubuntu 虚拟机** 中执行，而不是 deepin 宿主机。可通过以下命令确认目标地址：

```bash
hostname
ip -br a
```

## 2. 首次部署

### 安装 Node.js

项目要求 Node.js `20.19.0` 或更高版本。Ubuntu 26.04 的仓库当前提供 Node.js 22：

```bash
sudo apt-get install -y nodejs npm
node --version
npm --version
```

### 准备应用和配置

从 Git 仓库部署时：

```bash
git clone https://github.com/01xkp/Task-assignment.git ~/task-assignment
cd ~/task-assignment
cp .env.example .env.local
chmod 600 .env.local
```

编辑 `.env.local`，至少设置以下值：

```dotenv
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://your-openai-compatible-gateway
OPENAI_MODEL=gpt-5.6-terra
OPENAI_REASONING_EFFORT=high
OPENAI_DISABLE_RESPONSE_STORAGE=true
OPENAI_REQUEST_TIMEOUT_MS=360000
PORT=5174
DEVFLOW_HOST=0.0.0.0
```

任务拆分和方案复核始终使用服务端的 `OPENAI_MODEL`；页面不提供模型切换。配置变更后需要重启服务。

安装依赖、构建和测试：

```bash
cd ~/task-assignment
npm ci
npm run build
npm test
```

不要将 `.env.local` 或 `data/workspace.json` 提交到 Git。`data/workspace.json` 保存 PRD、任务和知识库数据，后续更新代码时应保留该文件。

## 3. systemd 服务

创建服务文件：

```bash
sudo tee /etc/systemd/system/task-assignment.service >/dev/null <<'EOF'
[Unit]
Description=DevFlow Task Assignment
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=gutta
WorkingDirectory=/home/gutta/task-assignment
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now task-assignment.service
sudo systemctl status task-assignment.service --no-pager
```

服务由 `gutta` 用户运行，`WorkingDirectory` 让应用从 `/home/gutta/task-assignment/.env.local` 读取模型配置。不要以 root 身份运行 Node 服务。

## 4. 验证访问

在虚拟机中检查服务、端口和模型配置：

```bash
systemctl is-active task-assignment.service
curl --fail --silent --show-error http://127.0.0.1:5174/api/health
ss -ltnp '( sport = :5174 )'
```

健康检查应返回 `"ok":true`，并且 `model.configured` 为 `true`。`model.model` 和 `reasoningEffort` 应与 `.env.local` 的 `OPENAI_MODEL`、`OPENAI_REASONING_EFFORT` 一致。

从 Windows 检查局域网访问：

```powershell
Invoke-RestMethod http://192.168.122.243:5174/api/health
```

页面地址为 [http://192.168.122.243:5174](http://192.168.122.243:5174)。生产模式不使用 `5173`。

若 Ubuntu 启用了 UFW，放行 Windows 所在的可信 LAN 网段。经 deepin 宿主机路由时，源地址仍是 Windows 的 `192.168.0.x`：

```bash
sudo ufw allow from 192.168.0.0/24 to any port 5174 proto tcp
sudo ufw status
```

应用没有登录和权限系统，不要将 `5174` 映射到公网。

## 5. 日常更新

部署新代码前先在本地验证：

```powershell
npm test
npm run build
git status --short
```

服务器为 Git 工作副本时，更新流程如下：

```bash
cd ~/task-assignment
git pull --ff-only
npm ci
npm run build
npm test
sudo systemctl restart task-assignment.service
curl --fail --silent --show-error http://127.0.0.1:5174/api/health
```

当前已部署实例若通过归档文件传输代码，可在 Windows 创建当前提交的归档并上传；解压会更新代码，但不会删除远端 `.env.local` 或 `data/workspace.json`：

```powershell
git archive --format=tar --output task-assignment-release.tar HEAD
scp task-assignment-release.tar gutta@192.168.122.243:~/
```

然后在虚拟机执行：

```bash
cd ~/task-assignment
tar -xf ~/task-assignment-release.tar
npm ci
npm run build
npm test
sudo systemctl restart task-assignment.service
rm ~/task-assignment-release.tar
```

传输 `.env.local` 时使用 SSH 或受控密钥管理渠道，传输后执行 `chmod 600 ~/task-assignment/.env.local`。除非明确需要迁移业务数据，不要覆盖远端 `data/workspace.json`。

## 6. 服务维护与故障排查

```bash
# 当前状态和最近日志
sudo systemctl status task-assignment.service --no-pager
sudo journalctl -u task-assignment.service -n 100 --no-pager

# 持续查看日志
sudo journalctl -u task-assignment.service -f

# 重启服务
sudo systemctl restart task-assignment.service

# 停止或取消开机启动
sudo systemctl disable --now task-assignment.service
```

常见检查顺序：

1. `systemctl is-active task-assignment.service` 应返回 `active`。
2. `curl http://127.0.0.1:5174/api/health` 应返回 `ok: true`。
3. Windows 访问失败时，检查静态路由、deepin 的转发规则和 UFW。
4. `configured: false` 表示 `.env.local` 缺少 `OPENAI_API_KEY`；配置修复后重启服务。
5. 502、504 或模型长时间运行时，先查看服务日志、网关状态和 `OPENAI_MODEL`，再按 [运行与维护](operations.md#9-模型耗时说明) 调整超时、复核或推理强度。

系统更新后可能提示有待加载的新内核。该提示不会阻止当前服务运行；选择维护窗口后再由管理员重启虚拟机，重启后用本节的健康检查确认服务已自动恢复。

## 7. 数据备份

备份前短暂停止服务，确保 JSON 文件未在写入：

```bash
sudo systemctl stop task-assignment.service
cp ~/task-assignment/data/workspace.json ~/task-assignment/data/workspace.$(date +%F-%H%M%S).json
sudo systemctl start task-assignment.service
```

恢复时先再次备份当前文件，再替换 `data/workspace.json`，最后重启服务并检查 PRD、任务和知识库数据。
