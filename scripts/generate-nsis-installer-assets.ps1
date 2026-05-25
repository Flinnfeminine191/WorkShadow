# 从 src/assets/logo.png 生成 NSIS 安装向导用 BMP（header / sidebar）
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$logoPath = Join-Path $root "src\assets\logo.png"
$outDir = Join-Path $root "src-tauri\icons\installer"

if (-not (Test-Path $logoPath)) {
  throw "缺少源图: $logoPath"
}
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

function Save-Bmp([System.Drawing.Bitmap]$bmp, [string]$path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $bmp.Dispose()
}

function New-GradientBitmap([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    (New-Object System.Drawing.Rectangle 0, 0, $w, $h),
    [System.Drawing.Color]::FromArgb(255, 245, 200, 220),
    [System.Drawing.Color]::FromArgb(255, 120, 140, 230),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $g.FillRectangle($brush, 0, 0, $w, $h)
  $g.Dispose()
  $brush.Dispose()
  $bmp
}

function Draw-CenteredLogo([System.Drawing.Bitmap]$canvas, [string]$logo, [double]$scale) {
  $src = [System.Drawing.Image]::FromFile($logo)
  $maxSide = [Math]::Min($canvas.Width, $canvas.Height) * $scale
  $ratio = [Math]::Min($maxSide / $src.Width, $maxSide / $src.Height)
  $w = [int]($src.Width * $ratio)
  $h = [int]($src.Height * $ratio)
  $x = ($canvas.Width - $w) / 2
  $y = ($canvas.Height - $h) / 2
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, $x, $y, $w, $h)
  $g.Dispose()
  $src.Dispose()
}

# NSIS 推荐尺寸
$header = New-GradientBitmap 150 57
Draw-CenteredLogo $header $logoPath 0.72
Save-Bmp $header (Join-Path $outDir "header.bmp")

$sidebar = New-GradientBitmap 164 314
Draw-CenteredLogo $sidebar $logoPath 0.55
Save-Bmp $sidebar (Join-Path $outDir "sidebar.bmp")

Write-Host "已生成: $outDir\header.bmp, sidebar.bmp"
