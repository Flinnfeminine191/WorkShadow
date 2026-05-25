/**
 * 从 src/assets/logo.png 生成 Tauri 图标，写入 src-tauri/icons 根目录（覆盖同名文件）。
 * 尝试删除 android / ios 子目录；若权限不足请关闭正在运行的 WorkShadow 后重试或手动删除。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const logo = path.join(root, "src", "assets", "logo.png");
const iconsDir = path.join(root, "src-tauri", "icons");
const tmpDir = path.join(root, "node_modules", ".cache", "workshadow-icons-tmp");

if (!fs.existsSync(logo)) {
  console.error("缺少源图: src/assets/logo.png");
  process.exit(1);
}

fs.mkdirSync(path.dirname(tmpDir), { recursive: true });
fs.rmSync(tmpDir, { recursive: true, force: true });

execSync(`npm run tauri -- icon "${logo}" -o "${tmpDir}"`, {
  cwd: root,
  stdio: "inherit",
  shell: true
});

function tryRmDir(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log("已删除:", path.relative(root, dir));
  } catch (e) {
    console.warn("无法删除（请关闭占用进程后重试）:", path.relative(root, dir), e.message);
  }
}

tryRmDir(path.join(iconsDir, "android"));
tryRmDir(path.join(iconsDir, "ios"));

fs.mkdirSync(iconsDir, { recursive: true });

for (const name of fs.readdirSync(tmpDir)) {
  const p = path.join(tmpDir, name);
  if (fs.statSync(p).isFile()) {
    fs.copyFileSync(p, path.join(iconsDir, name));
  }
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log("已同步桌面图标到 src-tauri/icons（根目录文件已更新）。");
