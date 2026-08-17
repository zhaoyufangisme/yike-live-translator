## 译刻 v0.2.0

### 新增

- 统一的 Argos Translate、MyMemory、百度翻译、DeepSeek、豆包五引擎架构。
- Windows 安装版集成真实 Argos Translate 与 `.argosmodel` 离线语言包管理。
- 百度、DeepSeek、豆包使用用户自己的 API 凭证；Windows 使用系统加密存储，Android 使用 Android Keystore。
- 翻译历史、隐私说明、Provider 真实状态与 GitHub Release 更新提醒。

### 优化

- 安装包改为包含完整本地界面，不再依赖译刻开发者服务器启动。
- 首页支持快速切换翻译引擎，并显示本次实际成功执行的 Provider 和模型。
- MyMemory 邮箱仅保存在用户设备，并直接发送给 MyMemory 官方服务。

### 修复

- 删除每次启动重置的假字符余额。
- 删除 ChatGPT 登录依赖和开发者代理翻译入口。
- Provider 失败时不再静默冒充其他引擎。

### 已知问题

- Android v0.2.0 暂不包含 Argos Python 本地运行时；Argos 离线翻译仅在 Windows 安装版可用。Android 上其他在线 Provider 仍由用户设备直连。
- 百度、DeepSeek、豆包需要用户自己的真实凭证才能完成最终连接验证。
