import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "client", "dist");
for (const target of [path.join(root, "desktop", "app"), path.join(root, "mobile", "www")]) {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
}
