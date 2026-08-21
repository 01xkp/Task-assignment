export const supportedPlatforms = ['共享 Flutter', 'Android', 'iOS', 'macOS', 'Windows', 'Linux']
export const taskPlatforms = [...supportedPlatforms, '服务端']

export const projectContext = {
  name: 'Agino Flutter 客户端',
  repository: 'D:\\agino-main\\frontend',
  sdk: 'Flutter 3.44.6 / Dart 3.12.2',
  platforms: ['Android', 'iOS', 'macOS', 'Windows', 'Linux'],
  architecture: 'feature-first；Presentation 使用 MVVM，Data 使用 Repository / Service，复杂共享规则进入 Domain Use Case。',
  modules: [
    { id: 'chat', name: '会话与聊天', path: 'lib/features/chat', scope: '会话列表、群聊、实时消息、消息状态、Agent 回复、转发、搜索与聊天稳定性', scale: '134 Dart / 181 tests' },
    { id: 'agents', name: 'Agent 接入与关系', path: 'lib/features/agents', scope: 'Agent 配对、资料、关系、外部权限、OpenClaw 与连接管理', scale: '70 Dart' },
    { id: 'auth', name: '账号与认证', path: 'lib/features/auth', scope: '注册登录、凭证绑定、密码、安全设置与账号注销', scale: '38 Dart' },
    { id: 'notifications', name: '通知中心', path: 'lib/features/notifications', scope: '通知列表、未读、场景跳转、批量操作与本地缓存', scale: '26 Dart' },
    { id: 'attachments', name: '附件与媒体', path: 'lib/features/attachments', scope: '文件选择、权限、图片压缩、预览、缓存、保存与聊天发送', scale: '23 Dart' },
    { id: 'invitations', name: '邀请与内测准入', path: 'lib/features/invitations', scope: '邀请码、邀请详情、注册衔接与剪贴板', scale: '20 Dart' },
    { id: 'agent_public_space', name: 'Agent 公开空间', path: 'lib/features/agent_public_space', scope: '公开资料、发布状态、公开权限与空间内容', scale: '20 Dart' },
    { id: 'profile', name: '个人资料', path: 'lib/features/profile', scope: '资料编辑、头像裁剪上传与群组指标', scale: '10 Dart' },
    { id: 'dev_debug', name: '开发调试', path: 'lib/features/dev_debug', scope: 'API 环境、日志开关、运行时配置与本地数据清理', scale: '7 Dart' },
    { id: 'friends', name: '好友与通讯录', path: 'lib/features/friends', scope: '好友数据、通讯录、本地缓存与关系接口', scale: '6 Dart' },
    { id: 'uploads', name: '上传服务', path: 'lib/features/uploads', scope: '上传 API、上传模型与公共上传 Repository', scale: '5 Dart' },
    { id: 'about', name: '关于与版本', path: 'lib/features/about', scope: '安装包版本信息与关于页面', scale: '5 Dart' },
    { id: 'display_settings', name: '显示设置', path: 'lib/features/display_settings', scope: '字体显示偏好与本地持久化', scale: '4 Dart' },
    { id: 'desktop', name: '桌面基础设施', path: 'lib/desktop', scope: 'Windows/macOS/Linux 窗口、托盘、关闭生命周期、宽屏布局与 Linux 字体缩放', scale: '7 Dart' },
    { id: 'core', name: '跨模块基础设施', path: 'lib/core', scope: '网络、设备平台、存储、主题、敏感数据保护与环境配置', scale: 'shared' },
  ],
}

export function formatProjectContext() {
  const modules = projectContext.modules
    .map((module) => `- ${module.name}｜${module.path}｜${module.scope}｜规模：${module.scale}`)
    .join('\n')
  return `项目：${projectContext.name}\n工具链：${projectContext.sdk}\n目标平台：${projectContext.platforms.join('、')}\n架构：${projectContext.architecture}\n\n模块清单：\n${modules}`
}
