"use client";

import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  Download,
  ImagePlus,
  LoaderCircle,
  Mic,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Side = "left" | "right";
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type SpeechRecognitionEventLike = { results: { [index: number]: { [index: number]: { transcript: string } } } };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const LANGUAGES = [
  { code: "en", name: "英语", native: "English", locale: "en-US", ocr: "eng" },
  { code: "ja", name: "日语", native: "日本語", locale: "ja-JP", ocr: "jpn" },
  { code: "ko", name: "韩语", native: "한국어", locale: "ko-KR", ocr: "kor" },
  { code: "fr", name: "法语", native: "Français", locale: "fr-FR", ocr: "fra" },
  { code: "de", name: "德语", native: "Deutsch", locale: "de-DE", ocr: "deu" },
  { code: "es", name: "西班牙语", native: "Español", locale: "es-ES", ocr: "spa" },
  { code: "pt", name: "葡萄牙语", native: "Português", locale: "pt-BR", ocr: "por" },
  { code: "ru", name: "俄语", native: "Русский", locale: "ru-RU", ocr: "rus" },
  { code: "it", name: "意大利语", native: "Italiano", locale: "it-IT", ocr: "ita" },
  { code: "ar", name: "阿拉伯语", native: "العربية", locale: "ar-SA", ocr: "ara" },
  { code: "th", name: "泰语", native: "ไทย", locale: "th-TH", ocr: "tha" },
  { code: "vi", name: "越南语", native: "Tiếng Việt", locale: "vi-VN", ocr: "vie" },
  { code: "id", name: "印度尼西亚语", native: "Bahasa Indonesia", locale: "id-ID", ocr: "ind" },
  { code: "ms", name: "马来语", native: "Bahasa Melayu", locale: "ms-MY", ocr: "msa" },
];

const CURRENCIES = [
  { code: "USD", country: "美国", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", country: "欧元区", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", country: "英国", symbol: "£", flag: "🇬🇧" },
  { code: "JPY", country: "日本", symbol: "¥", flag: "🇯🇵" },
  { code: "KRW", country: "韩国", symbol: "₩", flag: "🇰🇷" },
  { code: "HKD", country: "中国香港", symbol: "HK$", flag: "🇭🇰" },
  { code: "SGD", country: "新加坡", symbol: "S$", flag: "🇸🇬" },
  { code: "MYR", country: "马来西亚", symbol: "RM", flag: "🇲🇾" },
  { code: "PHP", country: "菲律宾", symbol: "₱", flag: "🇵🇭" },
  { code: "THB", country: "泰国", symbol: "฿", flag: "🇹🇭" },
  { code: "AUD", country: "澳大利亚", symbol: "A$", flag: "🇦🇺" },
  { code: "CAD", country: "加拿大", symbol: "C$", flag: "🇨🇦" },
];

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("zh-CN", { maximumFractionDigits: 4 }) : "";
}

export default function Home() {
  const [languageCode, setLanguageCode] = useState("en");
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [activeSide, setActiveSide] = useState<Side>("left");
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [copied, setCopied] = useState<Side | null>(null);
  const [listening, setListening] = useState<Side | null>(null);
  const [speechMessage, setSpeechMessage] = useState("");
  const [image, setImage] = useState<{ name: string; url: string } | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [foreignAmount, setForeignAmount] = useState("100");
  const [cnyAmount, setCnyAmount] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [rateUpdated, setRateUpdated] = useState("");
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const language = useMemo(() => LANGUAGES.find((item) => item.code === languageCode) ?? LANGUAGES[0], [languageCode]);
  const currency = useMemo(() => CURRENCIES.find((item) => item.code === currencyCode) ?? CURRENCIES[0], [currencyCode]);
  const sourceText = activeSide === "left" ? leftText : rightText;

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setInstallHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!sourceText.trim()) {
      if (activeSide === "left") setRightText("");
      else setLeftText("");
      setTranslationError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setTranslating(true);
      setTranslationError("");
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sourceText,
            source: activeSide === "left" ? languageCode : "zh-CN",
            target: activeSide === "left" ? "zh-CN" : languageCode,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("翻译服务暂时不可用");
        const data = (await response.json()) as { translatedText?: string };
        if (activeSide === "left") setRightText(data.translatedText ?? "");
        else setLeftText(data.translatedText ?? "");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setTranslationError("暂时无法连接翻译服务，请稍后重试");
      } finally {
        if (!controller.signal.aborted) setTranslating(false);
      }
    }, 550);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeSide, languageCode, sourceText]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRate() {
      setRateLoading(true);
      setRateError("");
      try {
        const response = await fetch(`/api/rates?base=${currencyCode}`, { signal: controller.signal });
        if (!response.ok) throw new Error("rate unavailable");
        const data = (await response.json()) as { rate: number; updated: string };
        setRate(data.rate);
        setRateUpdated(data.updated);
        const amount = Number(foreignAmount.replace(/,/g, ""));
        if (Number.isFinite(amount)) setCnyAmount(formatMoney(amount * data.rate));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setRateError("汇率更新失败，请稍后重试");
      } finally {
        if (!controller.signal.aborted) setRateLoading(false);
      }
    }
    void loadRate();
    return () => controller.abort();
    // foreignAmount intentionally excluded: currency change refreshes using current value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyCode]);

  const handleText = (side: Side, value: string) => {
    setActiveSide(side);
    if (side === "left") setLeftText(value.slice(0, 5000));
    else setRightText(value.slice(0, 5000));
  };

  const copyText = async (side: Side) => {
    const text = side === "left" ? leftText : rightText;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(side);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const clearAll = () => {
    setLeftText("");
    setRightText("");
    setTranslationError("");
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
  };

  const speak = (side: Side) => {
    const text = side === "left" ? leftText : rightText;
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = side === "left" ? language.locale : "zh-CN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const startListening = (side: Side) => {
    setSpeechMessage("");
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage("当前浏览器不支持语音识别，建议使用最新版 Chrome 或 Edge");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = side === "left" ? language.locale : "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => handleText(side, event.results[0][0].transcript);
    recognition.onend = () => setListening(null);
    recognition.onerror = () => {
      setListening(null);
      setSpeechMessage("没有听清，请检查麦克风权限后重试");
    };
    recognitionRef.current = recognition;
    setListening(side);
    recognition.start();
  };

  const processImage = useCallback(async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      setTranslationError("图片不能超过 10MB");
      return;
    }
    if (image) URL.revokeObjectURL(image.url);
    const imageUrl = URL.createObjectURL(file);
    setImage({ name: file.name, url: imageUrl });
    setOcrProgress(0);
    setTranslationError("");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(language.ocr, 1, {
        logger: (message) => {
          if (typeof message.progress === "number") setOcrProgress(Math.round(message.progress * 100));
        },
      });
      const result = await worker.recognize(file);
      await worker.terminate();
      handleText("left", result.data.text.trim());
      if (!result.data.text.trim()) setTranslationError("没有识别到清晰文字，请尝试更清楚的图片");
    } catch {
      setTranslationError("图片文字识别失败，请检查网络后重试");
    } finally {
      setOcrProgress(null);
    }
  }, [image, language.ocr]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void processImage(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void processImage(event.dataTransfer.files?.[0]);
  };

  const changeForeignAmount = (value: string) => {
    setForeignAmount(value);
    if (rate !== null) {
      const numeric = Number(value.replace(/,/g, ""));
      setCnyAmount(Number.isFinite(numeric) ? formatMoney(numeric * rate) : "");
    }
  };

  const changeCnyAmount = (value: string) => {
    setCnyAmount(value);
    if (rate) {
      const numeric = Number(value.replace(/,/g, ""));
      setForeignAmount(Number.isFinite(numeric) ? formatMoney(numeric / rate) : "");
    }
  };

  const installApp = async () => {
    if (!installPrompt) {
      setInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="译刻首页">
          <span className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></span>
          <span>译刻</span>
        </a>
        <div className="topbar-actions">
          <span className="status-pill"><i /> 实时翻译已就绪</span>
          {!installed && <button className="install-button" onClick={installApp}><Download size={15} /> 安装应用</button>}
          {installed && <span className="installed-pill"><Check size={14} /> 已安装</span>}
        </div>
      </header>

      {installHelp && (
        <div className="install-guide" role="dialog" aria-label="安装译刻">
          <div>
            <span className="guide-icon"><Download size={19} /></span>
            <p><b>把译刻安装到设备</b><small>iPhone/iPad：点浏览器“分享”→“添加到主屏幕”；电脑或安卓：打开浏览器菜单，选择“安装应用”。</small></p>
          </div>
          <button onClick={() => setInstallHelp(false)} aria-label="关闭安装说明"><X size={17} /></button>
        </div>
      )}

      <section className="hero-copy">
        <p className="eyebrow">TRANSLATE IN THE MOMENT</p>
        <h1>所想，即刻相通。</h1>
        <p>文字、声音或图片，让每一次表达自然抵达。</p>
      </section>

      <section className="translator-card" aria-label="实时翻译">
        <div className="language-bar">
          <div className="select-wrap">
            <button className="language-select" onClick={() => setLanguageOpen((open) => !open)} aria-expanded={languageOpen}>
              <span>{language.name}</span><small>{language.native}</small><ChevronDown size={15} />
            </button>
            {languageOpen && (
              <div className="select-menu language-menu">
                {LANGUAGES.map((item) => (
                  <button key={item.code} onClick={() => { setLanguageCode(item.code); setLanguageOpen(false); }} className={item.code === languageCode ? "selected" : ""}>
                    <span>{item.name}<small>{item.native}</small></span>{item.code === languageCode && <Check size={15} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className={`flow-icon ${translating ? "working" : ""}`}><ArrowRightLeft size={17} /></span>
          <div className="language-fixed">中文 <span>固定</span></div>
        </div>

        <div className="translation-grid">
          <div className={`translation-pane source-pane ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <textarea value={leftText} onChange={(event) => handleText("left", event.target.value)} aria-label={`输入${language.name}`} placeholder="输入文字，或试试语音和图片…" />
            {image && (
              <div className="image-chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="待识别图片预览" />
                <span>{ocrProgress === null ? image.name : `正在识别 ${ocrProgress}%`}</span>
                {ocrProgress !== null && <LoaderCircle size={14} className="spin" />}
                <button aria-label="移除图片" onClick={() => { URL.revokeObjectURL(image.url); setImage(null); }}><X size={14} /></button>
              </div>
            )}
            {dragging && <div className="drop-overlay"><Upload size={24} /><b>松开即可识别图片</b></div>}
            <div className="pane-actions">
              <button className={listening === "left" ? "active" : ""} onClick={() => startListening("left")} aria-label="外语语音输入"><Mic size={19} /></button>
              <button onClick={() => fileInputRef.current?.click()} aria-label="上传图片"><ImagePlus size={19} /></button>
              <button onClick={() => speak("left")} aria-label="朗读外语"><Volume2 size={19} /></button>
              <button onClick={() => copyText("left")} aria-label="复制外语">{copied === "left" ? <Check size={18} /> : <Copy size={18} />}</button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} hidden />
              <span>{leftText.length.toLocaleString()} / 5,000</span>
            </div>
          </div>

          <div className="translation-pane result-pane">
            <textarea value={rightText} onChange={(event) => handleText("right", event.target.value)} aria-label="输入中文" placeholder="中文翻译会实时显示在这里" />
            {translating && <span className="translating-label"><LoaderCircle size={13} className="spin" /> 翻译中</span>}
            <div className="pane-actions">
              <button className={listening === "right" ? "active" : ""} onClick={() => startListening("right")} aria-label="中文语音输入"><Mic size={19} /></button>
              <button onClick={() => speak("right")} aria-label="朗读中文"><Volume2 size={19} /></button>
              <button onClick={() => copyText("right")} aria-label="复制中文">{copied === "right" ? <Check size={18} /> : <Copy size={18} />}</button>
              <button onClick={clearAll} aria-label="清空内容"><Trash2 size={18} /></button>
              <span>{rightText.length.toLocaleString()} / 5,000</span>
            </div>
          </div>
        </div>
        {(translationError || speechMessage) && <div className="inline-message">{translationError || speechMessage}</div>}
      </section>

      <section className="rates-section" aria-label="实时汇率换算">
        <div className="section-heading">
          <div><p className="eyebrow">LIVE EXCHANGE RATE</p><h2>实时汇率</h2></div>
          <div className="rate-meta"><i /> {rateLoading ? "正在更新…" : rateUpdated ? `更新于 ${rateUpdated}` : "实时数据"}</div>
        </div>
        <div className="rates-card">
          <div className="currency-headings">
            <div className="select-wrap">
              <button className="currency-select" onClick={() => setCurrencyOpen((open) => !open)} aria-expanded={currencyOpen}>
                <span className="flag">{currency.flag}</span><span><b>{currency.country}</b><small>{currency.code}</small></span><ChevronDown size={16} />
              </button>
              {currencyOpen && (
                <div className="select-menu currency-menu">
                  {CURRENCIES.map((item) => (
                    <button key={item.code} onClick={() => { setCurrencyCode(item.code); setCurrencyOpen(false); }} className={item.code === currencyCode ? "selected" : ""}>
                      <span className="flag">{item.flag}</span><span><b>{item.country}</b><small>{item.code}</small></span>{item.code === currencyCode && <Check size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rate-center">{rate ? `1 ${currencyCode} = ${rate.toFixed(4)} CNY` : "—"}</div>
            <div className="china-label"><span className="flag">🇨🇳</span><span><b>中国</b><small>CNY</small></span></div>
          </div>
          <div className="currency-inputs">
            <label><span>{currency.symbol}</span><input value={foreignAmount} onChange={(event) => changeForeignAmount(event.target.value)} inputMode="decimal" aria-label={`${currencyCode}金额`} /></label>
            <span className="equals">=</span>
            <label><span>¥</span><input value={cnyAmount} onChange={(event) => changeCnyAmount(event.target.value)} inputMode="decimal" aria-label="人民币金额" /></label>
          </div>
          {rateError && <div className="inline-message rate-error">{rateError}</div>}
        </div>
      </section>

      <footer><span>译刻 · 简单而准确的沟通工具</span><span><Clipboard size={14} /> 图片仅在当前设备处理</span></footer>
    </main>
  );
}
