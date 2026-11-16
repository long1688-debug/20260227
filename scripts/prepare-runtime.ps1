<#
  准备随安装包分发的运行时依赖，输出到 tauri-app/src-tauri/resources/runtime/
  用法: powershell -ExecutionPolicy Bypass -File scripts\prepare-runtime.ps1 -ZLMediaKitDir D:\ZLMediaKit\release\windows\Release
#>
param(
    [Parameter(Mandatory = $true)][string]$ZLMediaKitDir,
    [string]$NodeVersion = "20.18.1",
    # 随包附带的 Whisper 模型（tiny/base/small/medium），程序运行时不再在线下载
    [string]$WhisperModel = "base",
    # 可选：已下载好的 ggml-*.bin 所在目录，指定后不联网
    [string]$WhisperModelDir = "",
    [switch]$Force
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root "tauri-app\src-tauri\resources\runtime"
$tmp = Join-Path $env:TEMP "prepare-runtime"
New-Item -ItemType Directory -Force -Path $runtime, $tmp | Out-Null

function Get-Zip($url, $name) {
    $zip = Join-Path $tmp "$name.zip"
    if ($Force -or -not (Test-Path $zip)) { Invoke-WebRequest -Uri $url -OutFile $zip }
    $dest = Join-Path $tmp $name
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    Expand-Archive -Path $zip -DestinationPath $dest
    return $dest
}

# ffmpeg
$ffDir = Join-Path $runtime "ffmpeg"
if ($Force -or -not (Test-Path "$ffDir\ffmpeg.exe")) {
    Write-Host "下载 ffmpeg ..."
    $x = Get-Zip "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" "ffmpeg"
    New-Item -ItemType Directory -Force -Path $ffDir | Out-Null
    Get-ChildItem -Recurse -Path $x -Include ffmpeg.exe, ffprobe.exe | Copy-Item -Destination $ffDir -Force
}

# node (portable) for server/
$nodeDir = Join-Path $runtime "node"
if ($Force -or -not (Test-Path "$nodeDir\node.exe")) {
    Write-Host "下载 Node.js $NodeVersion ..."
    $x = Get-Zip "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" "node"
    New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
    Copy-Item (Get-ChildItem -Recurse -Path $x -Filter node.exe | Select-Object -First 1).FullName $nodeDir -Force
}

# server/
Write-Host "复制 server ..."
$serverDst = Join-Path $runtime "server"
if (Test-Path $serverDst) { Remove-Item -Recurse -Force $serverDst }
robocopy (Join-Path $root "server") $serverDst /E /XD node_modules data temp dist logs /NFL /NDL /NJH /NJS | Out-Null
Push-Location $serverDst
npm ci --omit=dev --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
Pop-Location

# ZLMediaKit
if (-not (Test-Path (Join-Path $ZLMediaKitDir "MediaServer.exe"))) { throw "在 $ZLMediaKitDir 下找不到 MediaServer.exe" }
Write-Host "复制 ZLMediaKit ..."
$zlmDst = Join-Path $runtime "zlmediakit"
if (Test-Path $zlmDst) { Remove-Item -Recurse -Force $zlmDst }
robocopy $ZLMediaKitDir $zlmDst /E /XF *.pdb *.ilk *.log /XD log www\record /NFL /NDL /NJH /NJS | Out-Null

# Whisper 模型（whisper.cpp ggml 格式，MIT 许可）
$wDir = Join-Path $runtime "models\whisper"
New-Item -ItemType Directory -Force -Path $wDir | Out-Null
$wFile = "ggml-$WhisperModel.bin"
$wDst = Join-Path $wDir $wFile
if ($WhisperModelDir) {
    Copy-Item (Join-Path $WhisperModelDir $wFile) $wDst -Force
} elseif ($Force -or -not (Test-Path $wDst)) {
    Write-Host "下载 Whisper 模型 $wFile ..."
    Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$wFile" -OutFile $wDst
}

# 物体检测模型（YOLOX-Nano，Apache-2.0，Megvii 官方发布）
$dDir = Join-Path $runtime "models\detection"
New-Item -ItemType Directory -Force -Path $dDir | Out-Null
$dDst = Join-Path $dDir "yolox_nano.onnx"
if ($Force -or -not (Test-Path $dDst)) {
    Write-Host "下载检测模型 yolox_nano.onnx ..."
    Invoke-WebRequest -Uri "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx" -OutFile $dDst
}

# WebView2 bootstrapper
$wv = Join-Path $runtime "MicrosoftEdgeWebview2Setup.exe"
if ($Force -or -not (Test-Path $wv)) {
    Write-Host "下载 WebView2 bootstrapper ..."
    Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $wv
}

Write-Host "完成: $runtime"
