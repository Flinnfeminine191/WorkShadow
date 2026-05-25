# 为 Tauri Windows 打包准备 NSIS（解决 GitHub TLS DecodeError）
# 用法：
#   .\scripts\setup-tauri-bundler-tools.ps1
#   .\scripts\setup-tauri-bundler-tools.ps1 -OfflineDir D:\tauri-tools
#
# 离线目录需含：nsis-3.11.zip、nsis_tauri_utils.dll（v0.5.3）

param(
  [string]$OfflineDir = "",
  [switch]$UseMirror = $true
)

$ErrorActionPreference = "Stop"

function Get-MirrorUrl([string]$Url) {
  if ($UseMirror) { return "https://ghproxy.net/$Url" }
  return $Url
}

function Download-File([string]$Url, [string]$OutPath) {
  if (Test-Path $OutPath) { Remove-Item $OutPath -Force }
  Write-Host "  下载 -> $OutPath"
  curl.exe -L --fail --retry 3 --connect-timeout 30 -o $OutPath (Get-MirrorUrl $Url)
  if (-not (Test-Path $OutPath) -or (Get-Item $OutPath).Length -lt 1KB) {
    throw "下载失败: $Url"
  }
}

function Copy-IfExists([string]$Src, [string]$Dst) {
  if (-not (Test-Path $Src)) { throw "缺少文件: $Src" }
  Copy-Item $Src $Dst -Force
}

$tauriDir = Join-Path $env:LOCALAPPDATA "tauri"
$temp = Join-Path $env:TEMP "workshadow-bundler-setup"
Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $temp -Force | Out-Null

$nsisZipUrl = "https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip"
$utilsDllUrl = "https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll"

$nsisZip = Join-Path $temp "nsis-3.11.zip"
$utilsDll = Join-Path $temp "nsis_tauri_utils.dll"

if ($OfflineDir -and (Test-Path $OfflineDir)) {
  Write-Host "使用离线目录: $OfflineDir"
  Copy-IfExists (Join-Path $OfflineDir "nsis-3.11.zip") $nsisZip
  Copy-IfExists (Join-Path $OfflineDir "nsis_tauri_utils.dll") $utilsDll
} else {
  Write-Host "下载 NSIS 3.11（经 ghproxy，直连 GitHub 易 TLS 失败）..."
  Download-File $nsisZipUrl $nsisZip
  Download-File $utilsDllUrl $utilsDll
}

# 与 Tauri bundler 一致：解压到 tauri 目录，再将 nsis-3.11 重命名为 NSIS
Remove-Item (Join-Path $tauriDir "NSIS") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $tauriDir "nsis-3.11") -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $tauriDir -Force | Out-Null

Expand-Archive -Path $nsisZip -DestinationPath $tauriDir -Force

$extracted = Join-Path $tauriDir "nsis-3.11"
$dest = Join-Path $tauriDir "NSIS"
if (-not (Test-Path $extracted)) {
  throw "解压后未找到 nsis-3.11 目录，请检查 zip 是否完整"
}
Rename-Item -Path $extracted -NewName "NSIS"

$additionalDir = Join-Path $dest "Plugins\x86-unicode\additional"
New-Item -ItemType Directory -Path $additionalDir -Force | Out-Null
Copy-Item $utilsDll (Join-Path $additionalDir "nsis_tauri_utils.dll") -Force

Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue

$required = @(
  "makensis.exe",
  "Include\MUI2.nsh",
  "Plugins\x86-unicode\additional\nsis_tauri_utils.dll"
)
$missing = $required | Where-Object { -not (Test-Path (Join-Path $dest $_)) }

Write-Host ""
Write-Host "已安装: $dest"
if ($missing.Count -gt 0) {
  Write-Host "缺少文件:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
Write-Host "校验通过，可执行: npm run tauri build" -ForegroundColor Green
