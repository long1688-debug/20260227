# SRS (Simple Realtime Server) 安装脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SRS 流媒体服务器安装脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$SRS_VERSION = "5.0.200"
$SRS_URL = "https://github.com/ossrs/srs/releases/download/v$SRS_VERSION/srs-windows-x86_64-$SRS_VERSION.zip"
$SRS_DIR = "C:\SRS"
$SRS_ZIP = "$env:TEMP\srs-$SRS_VERSION.zip"

if (Test-Path "$SRS_DIR\objs\srs.exe") {
    Write-Host "[OK] SRS 已安装在: $SRS_DIR" -ForegroundColor Green
    $confirm = Read-Host "是否重新安装？(y/n)"
    if ($confirm -ne 'y') {
        Write-Host "取消安装" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "[1/4] 创建安装目录..." -ForegroundColor Yellow
if (-not (Test-Path $SRS_DIR)) {
    New-Item -ItemType Directory -Path $SRS_DIR -Force | Out-Null
    Write-Host "  OK 创建目录: $SRS_DIR" -ForegroundColor Green
}

Write-Host "[2/4] 下载 SRS..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $SRS_URL -OutFile $SRS_ZIP -UseBasicParsing
    Write-Host "  OK 下载完成" -ForegroundColor Green
} catch {
    Write-Host "  X 下载失败: $_" -ForegroundColor Red
    Write-Host "请手动下载 SRS from https://github.com/ossrs/srs/releases" -ForegroundColor Yellow
    exit 1
}

Write-Host "[3/4] 解压 SRS..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $SRS_ZIP -DestinationPath "$SRS_DIR\temp" -Force
    $tempDir = Get-ChildItem "$SRS_DIR\temp" -Directory | Select-Object -First 1
    if ($tempDir) {
        Move-Item "$($tempDir.FullName)\*" $SRS_DIR -Force
        Remove-Item "$SRS_DIR\temp" -Recurse -Force
    }
    Write-Host "  OK 解压完成" -ForegroundColor Green
} catch {
    Write-Host "  X 解压失败: $_" -ForegroundColor Red
    exit 1
}

Remove-Item $SRS_ZIP -ErrorAction SilentlyContinue

Write-Host "[4/4] 配置 SRS..." -ForegroundColor Yellow

$srsConfig = @"
listen              1935;
max_connections     1000;
daemon              off;
srs_log_tank        console;
srs_log_level       info;

http_server {
    enabled         on;
    listen          8080;
    dir             ./objs/nginx/html;
}

vhost __defaultVhost__ {
    http_remux {
        enabled     on;
        mount       [vhost]/[app]/[stream].flv;
        hstrs       on;
    }

    hls {
        enabled         on;
        hls_path        ./objs/nginx/html;
        hls_fragment    10;
        hls_window      60;
    }

    rtc {
        enabled     on;
        rtmp_to_rtc on;
        rtc_to_rtmp on;
    }
}
"@

$configPath = "$SRS_DIR\conf\srs.conf"
Set-Content -Path $configPath -Value $srsConfig -Encoding UTF8
Write-Host "  OK 配置文件已创建" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SRS 安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "安装目录: $SRS_DIR"
Write-Host "HTTP 端口: 8080"
Write-Host "RTMP 端口: 1935"
Write-Host ""
