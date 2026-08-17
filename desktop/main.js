/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, safeStorage, shell } = require("electron");
const { createHash, randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SECRET_FIELDS = new Set(["baiduSecret", "deepseekApiKey", "doubaoApiKey"]);
const configFile = () => path.join(app.getPath("userData"), "provider-config.json");

function readStoredConfig() {
  try { return JSON.parse(fs.readFileSync(configFile(), "utf8")); } catch { return { public: {}, secrets: {} }; }
}

function decrypt(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return "";
  try { return safeStorage.decryptString(Buffer.from(value, "base64")); } catch { return ""; }
}

function getConfig() {
  const stored = readStoredConfig();
  const secrets = Object.fromEntries(Object.entries(stored.secrets || {}).map(([key, value]) => [key, decrypt(value)]));
  return { ...(stored.public || {}), ...secrets };
}

function saveConfig(config) {
  const current = readStoredConfig(); const publicConfig = {}; const secrets = { ...(current.secrets || {}) };
  for (const [key, value] of Object.entries(config || {})) {
    if (SECRET_FIELDS.has(key)) {
      if (value && safeStorage.isEncryptionAvailable()) secrets[key] = safeStorage.encryptString(String(value)).toString("base64");
      else if (!value) delete secrets[key];
    } else publicConfig[key] = value;
  }
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify({ public: publicConfig, secrets }, null, 2), { mode: 0o600 });
}

function providerError(name, status, data) {
  const detail = data?.error?.message || data?.error_msg || data?.message;
  if (status === 401 || status === 403) return `${name} 凭证无效或无权限`;
  if (status === 429) return `${name} 请求频率过高或额度受限`;
  return detail ? `${name}：${detail}` : `${name} 请求失败（HTTP ${status}）`;
}

async function myMemory(text, source, target, config) {
  const output = [];
  const encoder = new TextEncoder(); const pieces = [];
  for (const section of text.split(/(\n)/)) {
    if (section === "\n") { pieces.push(section); continue; }
    let current = "";
    for (const character of section) {
      if (current && encoder.encode(current + character).length > 450) { pieces.push(current); current = character; } else current += character;
    }
    if (current) pieces.push(current);
  }
  for (const part of pieces) {
    if (!part || part === "\n") { output.push(part); continue; }
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", part); url.searchParams.set("langpair", `${source}|${target}`);
    if (config.mymemoryEmail?.includes("@")) url.searchParams.set("de", config.mymemoryEmail);
    let response;
    try { response = await fetch(url, { headers: { Accept: "application/json" } }); }
    catch { throw new Error("MyMemory 当前网络不可用，可能被网络或 Cloudflare 拦截"); }
    const data = await response.json().catch(() => ({}));
    if (data.quotaFinished) throw new Error("MyMemory 官方返回：每日额度已达到限制");
    if (!response.ok || Number(data.responseStatus || 200) >= 400) throw new Error(data.responseDetails || providerError("MyMemory", response.status, data));
    output.push(data.responseData?.translatedText || "");
  }
  return { text: output.join(""), provider: "mymemory", usage: { characters: [...text].length }, checkedAt: new Date().toISOString() };
}

async function baidu(text, source, target, config) {
  if (!config.baiduAppId || !config.baiduSecret) throw new Error("百度翻译尚未配置 APP ID 与密钥");
  const salt = `${Date.now()}${randomBytes(3).toString("hex")}`;
  const sign = createHash("md5").update(`${config.baiduAppId}${text}${salt}${config.baiduSecret}`).digest("hex");
  const body = new URLSearchParams({ q: text, from: source === "zh-CN" ? "zh" : source, to: target === "zh-CN" ? "zh" : target, appid: config.baiduAppId, salt, sign });
  const response = await fetch("https://fanyi-api.baidu.com/api/trans/vip/translate", { method: "POST", body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error_code) throw new Error(data.error_msg ? `百度翻译：${data.error_msg}（${data.error_code}）` : providerError("百度翻译", response.status, data));
  return { text: (data.trans_result || []).map((item) => item.dst).join("\n"), provider: "baidu", usage: { characters: [...text].length }, checkedAt: new Date().toISOString() };
}

async function ai(provider, text, source, target, config) {
  const deepseek = provider === "deepseek"; const key = deepseek ? config.deepseekApiKey : config.doubaoApiKey; const name = deepseek ? "DeepSeek" : "豆包";
  if (!key) throw new Error(`${name} 尚未配置 API Key`);
  const endpoint = deepseek ? "https://api.deepseek.com/chat/completions" : (config.doubaoEndpoint || "https://ark.cn-beijing.volces.com/api/v3/chat/completions");
  const model = deepseek ? (config.deepseekModel || "deepseek-v4-flash") : (config.doubaoModel || "doubao-seed-2-0-lite-260215");
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: "system", content: `你是严格的翻译引擎。将用户内容从 ${source} 翻译为 ${target}，保持原有换行和排版，只输出译文。` }, { role: "user", content: text }], stream: false, ...(deepseek ? { thinking: { type: "disabled" } } : {}) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(providerError(name, response.status, data));
  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error(`${name} 未返回译文`);
  return { text: translated, provider, model: data.model || model, usage: { promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens, totalTokens: data.usage?.total_tokens }, checkedAt: new Date().toISOString() };
}

function argosCommand(payload) {
  const packagedExe = path.join(process.resourcesPath, "argos", "argos-service.exe");
  const executable = app.isPackaged ? packagedExe : "python"; const args = app.isPackaged ? [] : [path.join(__dirname, "argos_service.py")];
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true }); let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", () => reject(new Error("Argos 离线组件未安装或无法启动")));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || "Argos 离线组件执行失败"));
      try { const result = JSON.parse(stdout); if (result.ok) resolve(result.data); else reject(new Error(result.error || "Argos 操作失败")); }
      catch { reject(new Error("Argos 离线组件返回了无效数据")); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function translate(request) {
  const config = getConfig();
  if (request.provider === "argos") {
    const result = await argosCommand({ action: "translate", text: request.text, source: request.source === "zh-CN" ? "zh" : request.source, target: request.target === "zh-CN" ? "zh" : request.target });
    return { text: result.text, provider: "argos", model: result.model, checkedAt: new Date().toISOString() };
  }
  if (request.provider === "mymemory") return myMemory(request.text, request.source, request.target, config);
  if (request.provider === "baidu") return baidu(request.text, request.source, request.target, config);
  return ai(request.provider, request.text, request.source, request.target, config);
}

async function quota(provider) {
  const config = getConfig(); const checkedAt = new Date().toISOString();
  if (provider === "argos") return { kind: "offline", title: "本地离线", detail: "不按 API 字符额度收费", source: "Argos Translate 本地引擎", checkedAt };
  if (provider === "mymemory") return { kind: "reference", title: "免费在线服务", detail: `当前方式：${config.mymemoryEmail ? "已填写联系邮箱" : "匿名"}；实际剩余额度官方接口暂不支持实时查询`, source: "MyMemory 官方 API 规则", checkedAt };
  if (provider === "baidu") return { kind: "unavailable", title: "额度无法通过翻译接口查询", detail: "请以百度翻译开放平台控制台为准", source: "百度翻译开放平台", checkedAt };
  if (provider === "doubao") return { kind: "unavailable", title: "额度无法通过当前推理 API 查询", detail: "请以火山方舟控制台为准", source: "火山方舟官方控制台", checkedAt };
  if (!config.deepseekApiKey) return { kind: "unavailable", title: "未配置 API Key", detail: "配置后可查询官方真实余额", source: "DeepSeek 官方 API" };
  const response = await fetch("https://api.deepseek.com/user/balance", { headers: { Accept: "application/json", Authorization: `Bearer ${config.deepseekApiKey}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(providerError("DeepSeek", response.status, data));
  const values = (data.balance_infos || []).map((item) => `${item.currency} ${item.total_balance}`).join(" / ") || "无可用余额信息";
  return { kind: "balance", title: `账户余额：${values}`, detail: "计费方式：按 Token；不换算成字符额度", source: "DeepSeek 官方 Balance API", checkedAt };
}

function createWindow() {
  const window = new BrowserWindow({ width: 1240, height: 860, minWidth: 760, minHeight: 620, title: "译刻", backgroundColor: "#f4f3ed", autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.loadFile(path.join(__dirname, "app", "index.html"));
  window.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
}

ipcMain.handle("config:get", () => getConfig()); ipcMain.handle("config:save", (_event, config) => saveConfig(config));
ipcMain.handle("provider:translate", (_event, request) => translate(request)); ipcMain.handle("provider:test", (_event, provider) => translate({ provider, text: "Hello", source: "en", target: "zh-CN" })); ipcMain.handle("provider:quota", (_event, provider) => quota(provider));
ipcMain.handle("argos:list", () => argosCommand({ action: "list" })); ipcMain.handle("argos:install", (_event, fromCode, toCode) => argosCommand({ action: "install", source: fromCode, target: toCode })); ipcMain.handle("argos:delete", (_event, fromCode, toCode) => argosCommand({ action: "delete", source: fromCode, target: toCode }));

app.whenReady().then(() => { createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
