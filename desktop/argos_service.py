import json
import shutil
import sys
import argostranslate.package
import argostranslate.translate

def packages():
    return [{"fromCode": p.from_code, "toCode": p.to_code, "version": str(getattr(p, "package_version", "unknown")), "installed": True} for p in argostranslate.package.get_installed_packages()]

def run(payload):
    action = payload.get("action")
    if action == "list": return packages()
    if action == "translate":
        source, target = payload["source"], payload["target"]
        if (source, target) not in {(p.from_code, p.to_code) for p in argostranslate.package.get_installed_packages()}: raise RuntimeError(f"缺少离线语言包：{source} → {target}")
        return {"text": argostranslate.translate.translate(payload.get("text", ""), source, target), "model": f"Argos {source}→{target}"}
    if action == "install":
        source, target = payload["source"], payload["target"]
        argostranslate.package.update_package_index()
        candidates = [p for p in argostranslate.package.get_available_packages() if p.from_code == source and p.to_code == target]
        if not candidates: raise RuntimeError(f"官方仓库没有可用语言包：{source} → {target}")
        package = sorted(candidates, key=lambda p: str(getattr(p, "package_version", "")))[-1]
        argostranslate.package.install_from_path(package.download())
        return packages()
    if action == "delete":
        source, target = payload["source"], payload["target"]
        match = next((p for p in argostranslate.package.get_installed_packages() if p.from_code == source and p.to_code == target), None)
        if match is None: return packages()
        package_path = getattr(match, "package_path", None)
        if not package_path: raise RuntimeError("当前 Argos 版本不支持自动删除该语言包")
        shutil.rmtree(package_path, ignore_errors=False)
        return packages()
    raise RuntimeError("未知 Argos 操作")

try:
    print(json.dumps({"ok": True, "data": run(json.loads(sys.stdin.read()))}, ensure_ascii=True))
except Exception as error:
    print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=True))
    sys.exit(1)
