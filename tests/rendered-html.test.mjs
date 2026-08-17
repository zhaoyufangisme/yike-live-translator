import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the real Yike translator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /所想，即刻相通/);
  assert.match(html, /Argos Translate/);
  assert.match(html, /翻译引擎/);
  assert.match(html, /实时汇率/);
  assert.doesNotMatch(html, /Continue with ChatGPT|参考剩余|本机今日参考剩余/);
});

test("keeps provider execution honest and client-owned", async () => {
  const [page, providers, desktop, mobile, workflow] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/providers.ts", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.js", import.meta.url), "utf8"),
    readFile(new URL("../mobile/capacitor.config.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/build-installers.yml", import.meta.url), "utf8"),
  ]);
  for (const name of ["argos", "mymemory", "baidu", "deepseek", "doubao"]) assert.match(providers, new RegExp(`${name}:`));
  assert.match(page, /本次实际执行/);
  assert.match(providers, /api\.deepseek\.com\/user\/balance/);
  assert.match(desktop, /safeStorage\.encryptString/);
  assert.match(desktop, /fanyi-api\.baidu\.com/);
  assert.doesNotMatch(mobile, /chatgpt\.site|auth\.openai\.com|"server"/);
  assert.match(workflow, /refs\/tags\/v/);
  assert.match(workflow, /Yike-Setup-0\.2\.0\.exe/);
  assert.match(workflow, /Yike-Android-0\.2\.0\.apk/);
});
