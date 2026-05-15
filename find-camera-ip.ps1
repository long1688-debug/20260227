# Network Camera IP Finder Tool

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Network Camera IP Address Finder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Method 1: Check ARP cache
Write-Host "[Method 1] Checking ARP cache..." -ForegroundColor Yellow
arp -a | Select-String "dynamic"

Write-Host ""
Write-Host "Tip: Look for MAC addresses starting with common camera vendors:" -ForegroundColor Green
Write-Host "  - Hikvision: 00-12-01, 00-1E-8F, 7C-DF-A1" -ForegroundColor Gray
Write-Host "  - Dahua: 00-1D-71, 00-0C-29, 38-AF-29" -ForegroundColor Gray
Write-Host "  - Uniview: 00-16-3E, 2C-57-F4" -ForegroundColor Gray
Write-Host ""

# Method 2: Ping scan common subnets
Write-Host "[Method 2] Pinging common subnets..." -ForegroundColor Yellow
$commonSubnets = @(
    "192.168.1",
    "192.168.0",
    "192.168.31",
    "192.168.2",
    "10.0.0",
    "10.0.1"
)

foreach ($subnet in $commonSubnets) {
    Write-Host "  Scanning subnet: $subnet.0/24" -ForegroundColor Cyan

    # Test common camera IP positions
    $testIps = @(1, 10, 20, 50, 100, 150, 200, 254)

    foreach ($lastOctet in $testIps) {
        $ip = "$subnet.$lastOctet"

        # Ping with 1 second timeout
        $ping = Test-Connection -ComputerName $ip -Count 1 -TimeoutSeconds 1 -Quiet -ErrorAction SilentlyContinue

        if ($ping) {
            Write-Host "    [OK] $ip - Online" -ForegroundColor Green

            # Try to get hostname
            try {
                $hostname = [System.Net.Dns]::GetHostEntry($ip).HostName
                Write-Host "         Hostname: $hostname" -ForegroundColor Gray
            } catch {
                # Ignore DNS resolution failure
            }
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Scan complete! Check the online IPs above" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Record the found IP addresses" -ForegroundColor White
Write-Host "2. In CameraDiscoveryPanel, select 'Manual' mode" -ForegroundColor White
Write-Host "3. Enter the IP address to verify and add" -ForegroundColor White
