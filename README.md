# 译刻

译刻是一款无需账号的独立翻译客户端，支持外语与中文双向翻译、图片 OCR、语音输入、文字朗读和实时汇率换算。

## v0.2.0 翻译引擎

- **Argos Translate**：Windows 安装版真实本地离线翻译，使用 `.argosmodel` 语言包。
- **MyMemory**：免费在线备用服务，用户设备直接请求官方 API。
- **百度翻译**：使用用户自己的 APP ID 和密钥。
- **DeepSeek**：使用用户自己的 API Key，默认模型 `deepseek-v4-flash`。
- **豆包 / 火山方舟**：使用用户自己的 API Key 和 Model ID。

用户选择哪个 Provider，译刻就调用哪个 Provider；失败时不会静默冒充其他引擎。无法通过官方 API 查询的额度会明确标注为“无法实时查询”，不会显示本地生成的假余额。

## 隐私与独立运行

- 无 ChatGPT 登录、译刻账号、会员、订阅或支付。
- Windows 和 Android 安装包包含本地界面，启动不依赖开发者服务器。
- Windows API 密钥使用系统加密存储；Android 使用 Android Keystore。
- 翻译历史、设置和语言偏好默认保存在用户设备。
- 第三方 API 请求由用户设备直接发送给官方服务，不使用开发者 Key 或额度。

## 下载

进入仓库的 [Releases](https://github.com/zhaoyufangisme/yike-live-translator/releases) 页面下载独立版本：

- Windows：`Yike-Setup-0.2.0.exe`
- Android：`Yike-Android-0.2.0.apk`

Android v0.2.0 暂不包含 Argos Python 运行时；Argos 离线翻译目前仅在 Windows 安装版可用。Android 的 MyMemory、百度、DeepSeek 和豆包仍由用户设备直连。

## 在线版

[打开译刻在线版](https://yike-live-translator-2026.wwpbbms123.chatgpt.site/)

在线版不保存长期 API 密钥，并且不能运行本机 Argos 模型；完整能力请使用安装版。
