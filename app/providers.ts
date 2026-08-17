export type ProviderId = "argos" | "mymemory" | "baidu" | "deepseek" | "doubao";

export type ProviderConfig = {
  mymemoryEmail?: string;
  baiduAppId?: string;
  baiduSecret?: string;
  deepseekApiKey?: string;
  deepseekModel?: string;
  doubaoApiKey?: string;
  doubaoModel?: string;
  doubaoEndpoint?: string;
};

export type ProviderResult = {
  text: string;
  provider: ProviderId;
  model?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; characters?: number };
  checkedAt: string;
};

export type QuotaResult = {
  kind: "offline" | "reference" | "balance" | "unavailable";
  title: string;
  detail: string;
  source: string;
  checkedAt?: string;
};

export type ArgosPackage = {
  fromCode: string;
  toCode: string;
  version: string;
  size?: number;
  installed: boolean;
};

type NativeBridge = {
  platform: string;
  getConfig: () => Promise<ProviderConfig>;
  saveConfig: (config: ProviderConfig) => Promise<void>;
  translate: (request: { provider: ProviderId; text: string; source: string; target: string }) => Promise<ProviderResult>;
  testProvider: (provider: ProviderId) => Promise<ProviderResult>;
  getQuota: (provider: ProviderId) => Promise<QuotaResult>;
  listArgosPackages: () => Promise<ArgosPackage[]>;
  installArgosPackage: (fromCode: string, toCode: string) => Promise<ArgosPackage[]>;
  deleteArgosPackage: (fromCode: string, toCode: string) => Promise<ArgosPackage[]>;
};

declare global {
  interface Window { yikeNative?: NativeBridge }
}

export const PROVIDERS: Record<ProviderId, { name: string; model?: string; description: string }> = {
  argos: { name: "Argos Translate", description: "本地离线翻译，不使用第三方 API 额度" },
  mymemory: { name: "MyMemory", description: "国际免费在线服务，部分网络环境可能不可用" },
  baidu: { name: "百度翻译", description: "使用用户自己的 APP ID 与密钥" },
  deepseek: { name: "DeepSeek", model: "deepseek-v4-flash", description: "使用用户自己的 API Key，按 Token 计费" },
  doubao: { name: "豆包", model: "doubao-seed-2-0-lite-260215", description: "使用用户自己的火山方舟 API Key" },
};

const PUBLIC_CONFIG_KEY = "yike-provider-config-v2";
const SESSION_SECRET_KEY = "yike-provider-secrets-v2";

function readJson<T>(storage: Storage, key: string): T {
  try { return JSON.parse(storage.getItem(key) ?? "{}") as T; } catch { return {} as T; }
}

async function isCapacitorNative() {
  try { const { Capacitor } = await import("@capacitor/core"); return Capacitor.isNativePlatform(); } catch { return false; }
}

export async function loadProviderConfig(): Promise<ProviderConfig> {
  if (window.yikeNative) return window.yikeNative.getConfig();
  if (await isCapacitorNative()) {
    const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
    await SecureStorage.setKeyPrefix("yike_");
    const secrets = (await SecureStorage.get("provider_secrets", false)) as ProviderConfig | null;
    return { ...readJson<ProviderConfig>(localStorage, PUBLIC_CONFIG_KEY), ...(secrets ?? {}) };
  }
  return { ...readJson<ProviderConfig>(localStorage, PUBLIC_CONFIG_KEY), ...readJson<ProviderConfig>(sessionStorage, SESSION_SECRET_KEY) };
}

export async function saveProviderConfig(config: ProviderConfig) {
  if (window.yikeNative) return window.yikeNative.saveConfig(config);
  const { baiduSecret, deepseekApiKey, doubaoApiKey, ...publicConfig } = config;
  localStorage.setItem(PUBLIC_CONFIG_KEY, JSON.stringify(publicConfig));
  if (await isCapacitorNative()) {
    const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
    await SecureStorage.setKeyPrefix("yike_");
    await SecureStorage.set("provider_secrets", { baiduSecret: baiduSecret ?? "", deepseekApiKey: deepseekApiKey ?? "", doubaoApiKey: doubaoApiKey ?? "" });
    return;
  }
  sessionStorage.setItem(SESSION_SECRET_KEY, JSON.stringify({ baiduSecret, deepseekApiKey, doubaoApiKey }));
}

function cleanApiError(provider: string, status: number, payload: unknown) {
  const body = payload as { error?: { message?: string; code?: string }; error_msg?: string; message?: string };
  const message = body?.error?.message ?? body?.error_msg ?? body?.message;
  if (status === 401 || status === 403) return `${provider} 凭证无效或无权限`;
  if (status === 429) return `${provider} 请求频率过高或额度受限`;
  if (status >= 500) return `${provider} 官方服务暂时异常`;
  return message ? `${provider}：${message}` : `${provider} 请求失败（HTTP ${status}）`;
}

function decodeEntities(value: string) {
  const element = document.createElement("textarea");
  element.innerHTML = value;
  return element.value;
}

function splitUtf8(text: string, maxBytes = 450) {
  const encoder = new TextEncoder(); const chunks: string[] = []; let current = "";
  for (const character of text) {
    if (current && encoder.encode(current + character).length > maxBytes) { chunks.push(current); current = character; }
    else current += character;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function myMemoryTranslate(text: string, source: string, target: string, config: ProviderConfig, signal?: AbortSignal): Promise<ProviderResult> {
  const pieces = text.split(/(\n)/).flatMap((piece) => piece === "\n" ? [piece] : splitUtf8(piece));
  const output: string[] = [];
  for (const piece of pieces) {
    if (!piece || piece === "\n") { output.push(piece); continue; }
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", piece);
    url.searchParams.set("langpair", `${source}|${target}`);
    if (config.mymemoryEmail?.includes("@")) url.searchParams.set("de", config.mymemoryEmail);
    let response: Response;
    try { response = await fetch(url, { headers: { Accept: "application/json" }, signal }); }
    catch { throw new Error("MyMemory 当前网络不可用，可能被网络或 Cloudflare 拦截"); }
    const data = await response.json().catch(() => ({})) as { quotaFinished?: boolean; responseStatus?: number; responseDetails?: string; responseData?: { translatedText?: string } };
    if (data.quotaFinished) throw new Error("MyMemory 官方返回：每日额度已达到限制");
    if (!response.ok || (data.responseStatus ?? 200) >= 400) throw new Error(data.responseDetails || cleanApiError("MyMemory", response.status, data));
    output.push(decodeEntities(data.responseData?.translatedText ?? ""));
  }
  return { text: output.join(""), provider: "mymemory", usage: { characters: Array.from(text).length }, checkedAt: new Date().toISOString() };
}

async function aiTranslate(provider: "deepseek" | "doubao", text: string, source: string, target: string, config: ProviderConfig, signal?: AbortSignal): Promise<ProviderResult> {
  const isDeepSeek = provider === "deepseek";
  const key = isDeepSeek ? config.deepseekApiKey : config.doubaoApiKey;
  if (!key) throw new Error(`${PROVIDERS[provider].name} 尚未配置 API Key`);
  const endpoint = isDeepSeek ? "https://api.deepseek.com/chat/completions" : (config.doubaoEndpoint || "https://ark.cn-beijing.volces.com/api/v3/chat/completions");
  const model = isDeepSeek ? (config.deepseekModel || "deepseek-v4-flash") : (config.doubaoModel || "doubao-seed-2-0-lite-260215");
  const response = await fetch(endpoint, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `你是严格的翻译引擎。将用户内容从 ${source} 翻译为 ${target}，保持原有换行和排版，只输出译文。` },
        { role: "user", content: text },
      ],
      stream: false,
      ...(isDeepSeek ? { thinking: { type: "disabled" } } : {}),
    }),
  });
  const data = await response.json().catch(() => ({})) as { error?: { message?: string }; model?: string; choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
  if (!response.ok) throw new Error(cleanApiError(PROVIDERS[provider].name, response.status, data));
  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error(`${PROVIDERS[provider].name} 未返回译文`);
  return { text: translated, provider, model: data.model || model, usage: { promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens, totalTokens: data.usage?.total_tokens }, checkedAt: new Date().toISOString() };
}

async function md5(value: string) {
  const { default: CryptoJS } = await import("crypto-js");
  return CryptoJS.MD5(value).toString();
}

async function baiduTranslate(text: string, source: string, target: string, config: ProviderConfig, signal?: AbortSignal): Promise<ProviderResult> {
  if (!config.baiduAppId || !config.baiduSecret) throw new Error("百度翻译尚未配置 APP ID 与密钥");
  const salt = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const sign = await md5(`${config.baiduAppId}${text}${salt}${config.baiduSecret}`);
  const body = new URLSearchParams({ q: text, from: source === "zh-CN" ? "zh" : source, to: target === "zh-CN" ? "zh" : target, appid: config.baiduAppId, salt, sign });
  const response = await fetch("https://fanyi-api.baidu.com/api/trans/vip/translate", { method: "POST", body, signal });
  const data = await response.json().catch(() => ({})) as { error_code?: string; error_msg?: string; trans_result?: { dst: string }[] };
  if (!response.ok || data.error_code) throw new Error(data.error_msg ? `百度翻译：${data.error_msg}（${data.error_code}）` : cleanApiError("百度翻译", response.status, data));
  return { text: data.trans_result?.map((item) => item.dst).join("\n") ?? "", provider: "baidu", usage: { characters: Array.from(text).length }, checkedAt: new Date().toISOString() };
}

export async function translateWithProvider(provider: ProviderId, text: string, source: string, target: string, config: ProviderConfig, signal?: AbortSignal): Promise<ProviderResult> {
  if (window.yikeNative) return window.yikeNative.translate({ provider, text, source, target });
  if (provider === "argos") throw new Error(await isCapacitorNative() ? "Android v0.2.0 暂不包含 Argos 本地运行时，请选择其他翻译引擎" : "Argos 离线翻译仅在 Windows 安装版中运行；当前网页端无法加载本机模型");
  if (provider === "mymemory") return myMemoryTranslate(text, source, target, config, signal);
  if (provider === "baidu") return baiduTranslate(text, source, target, config, signal);
  return aiTranslate(provider, text, source, target, config, signal);
}

export async function testProvider(provider: ProviderId, config: ProviderConfig): Promise<ProviderResult> {
  if (window.yikeNative) return window.yikeNative.testProvider(provider);
  return translateWithProvider(provider, "Hello", "en", "zh-CN", config);
}

export async function getProviderQuota(provider: ProviderId, config: ProviderConfig): Promise<QuotaResult> {
  if (window.yikeNative) return window.yikeNative.getQuota(provider);
  const now = new Date().toISOString();
  if (provider === "argos") return { kind: "offline", title: "本地离线", detail: "不按 API 字符额度收费", source: "Argos Translate 本地引擎", checkedAt: now };
  if (provider === "mymemory") return { kind: "reference", title: "免费在线服务", detail: `当前方式：${config.mymemoryEmail ? "已填写联系邮箱" : "匿名"}；实际剩余额度官方接口暂不支持实时查询`, source: "MyMemory 官方 API 规则", checkedAt: now };
  if (provider === "baidu") return { kind: "unavailable", title: "额度无法通过翻译接口查询", detail: "具体免费额度、套餐用量与 QPS 请以百度翻译开放平台控制台为准", source: "百度翻译开放平台", checkedAt: now };
  if (provider === "doubao") return { kind: "unavailable", title: "额度无法通过当前推理 API 查询", detail: "余额、Token 和套餐请以火山方舟控制台为准", source: "火山方舟官方控制台", checkedAt: now };
  if (!config.deepseekApiKey) return { kind: "unavailable", title: "未配置 API Key", detail: "配置后可通过 DeepSeek 官方 Balance API 查询真实余额", source: "DeepSeek 官方 API" };
  const response = await fetch("https://api.deepseek.com/user/balance", { headers: { Accept: "application/json", Authorization: `Bearer ${config.deepseekApiKey}` } });
  const data = await response.json().catch(() => ({})) as { balance_infos?: { currency: string; total_balance: string }[] };
  if (!response.ok) throw new Error(cleanApiError("DeepSeek", response.status, data));
  const balances = data.balance_infos?.map((item) => `${item.currency} ${item.total_balance}`).join(" / ") || "无可用余额信息";
  return { kind: "balance", title: `账户余额：${balances}`, detail: "计费方式：按 Token；不换算成字符额度", source: "DeepSeek 官方 Balance API", checkedAt: now };
}

export async function listArgosPackages() { return window.yikeNative ? window.yikeNative.listArgosPackages() : []; }
export async function installArgosPackage(fromCode: string, toCode: string) {
  if (!window.yikeNative) throw new Error("请在 Windows 安装版中管理 Argos 离线语言包");
  return window.yikeNative.installArgosPackage(fromCode, toCode);
}
export async function deleteArgosPackage(fromCode: string, toCode: string) {
  if (!window.yikeNative) throw new Error("请在 Windows 安装版中管理 Argos 离线语言包");
  return window.yikeNative.deleteArgosPackage(fromCode, toCode);
}
