# 摄像机扫描诊断工具

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Camera Discovery Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check network interfaces
Write-Host "[Step 1] Checking Network Interfaces..." -ForegroundColor Yellow
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual"
} | Select-Object InterfaceAlias, IPAddress, PrefixLength, PrefixOrigin | Format-Table -AutoSize

Write-Host ""
Write-Host "[Step 2] Checking ARP Cache for Camera MAC Addresses..." -ForegroundColor Yellow
$arpEntries = arp -a | Select-String "dynamic"

if ($arpEntries) {
    Write-Host "Found ARP entries:" -ForegroundColor Green
    $arpEntries | ForEach-Object {
        $line = $_.Line
        # Look for common camera vendor MAC prefixes
        if ($line -match "00-12-01|00-1E-8F|7C-DF-A1|00-1D-71|00-0C-29|38-AF-29|00-16-3E|2C-57-F4") {
            Write-Host "  [CAMERA?] $line" -ForegroundColor Magenta
        } else {
            Write-Host "  $line" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "No ARP entries found" -ForegroundColor Red
}

Write-Host ""
Write-Host "[Step 3] Testing Common Camera IPs..." -ForegroundColor Yellow

# Get local IP to determine subnet
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq "Dhcp" } | Select-Object -First 1).IPAddress

if ($localIP) {
    Write-Host "Local IP: $localIP" -ForegroundColor Cyan

    # Extract subnet
    $parts = $localIP.Split('.')
    $subnet = "$($parts[0]).$($parts[1]).$($parts[2])"

    Write-Host "Testing common camera IPs in subnet $subnet.x..." -ForegroundColor Cyan

    $commonCameraIPs = @(
        1, 10, 20, 30, 40, 50, 60, 64, 100, 108, 150, 200, 254
    )

    foreach ($lastOctet in $commonCameraIPs) {
        $testIP = "$subnet.$lastOctet"

        # Quick ping test
        $pingResult = Test-Connection -ComputerName $testIP -Count 1 -Quiet -ErrorAction SilentlyContinue

        if ($pingResult) {
            Write-Host "  [ONLINE] $testIP" -ForegroundColor Green

            # Try to get hostname
            try {
                $hostname = [System.Net.Dns]::GetHostEntry($testIP).HostName
                Write-Host "           Hostname: $hostname" -ForegroundColor Gray
            } catch {
                # Ignore
            }

            # Try HTTP
            try {
                $response = Invoke-WebRequest -Uri "http://$testIP" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    Write-Host "           HTTP: OK (Status $($response.StatusCode))" -ForegroundColor Yellow
                }
            } catch {
                # HTTP not available
            }
        }
    }
} else {
    Write-Host "Could not determine local IP" -ForegroundColor Red
}

Write-Host ""
Write-Host "[Step 4] Checking Firewall Rules..." -ForegroundColor Yellow
$firewallRules = Get-NetFirewallRule -DisplayName "*ICMP*" -Enabled True -Direction Inbound -Action Allow | Select-Object -First 3

if ($firewallRules) {
    Write-Host "ICMP (Ping) is allowed:" -ForegroundColor Green
    $firewallRules | ForEach-Object {
        Write-Host "  - $($_.DisplayName)" -ForegroundColor Gray
    }
} else {
    Write-Host "Warning: ICMP might be blocked by firewall" -ForegroundColor Yellow
    Write-Host "Consider enabling File and Printer Sharing (Echo Request - ICMPv4-In)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostic Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check if any ONLINE IPs were found above" -ForegroundColor White
Write-Host "2. If cameras are on different subnet, use Manual Input mode" -ForegroundColor White
Write-Host "3. Verify camera is powered on and connected to network" -ForegroundColor White
Write-Host "4. Check router DHCP client list for camera IP" -ForegroundColor White
