
$Url = "http://localhost:8099/json-rpc"

Write-Host "HyperHDR Random RGB Test"
Write-Host "Press Ctrl+C to stop"
Write-Host ""

try {
    while ($true) {

        $red   = Get-Random -Minimum 0 -Maximum 256
        $green = Get-Random -Minimum 0 -Maximum 256
        $blue  = Get-Random -Minimum 0 -Maximum 256

        $body = @{
            command  = "color"
            color    = @($red, $green, $blue)
            priority = 50
            duration = 6000
        } | ConvertTo-Json -Compress

        try {
            $response = Invoke-RestMethod `
                -Uri $Url `
                -Method Post `
                -ContentType "application/json" `
                -Body $body `
                -TimeoutSec 5

            if ($response.success -eq $false) {
                Write-Host "HyperHDR error:" `
                    -ForegroundColor Red
                $response | ConvertTo-Json -Depth 10
            }
            else {
                Write-Host "RGB: $red, $green, $blue" `
                    -ForegroundColor Green
            }
        }
        catch {
            Write-Host "Connection error: $_" `
                -ForegroundColor Red
        }

        Start-Sleep -Seconds 5
    }
}
finally {
    # Clear test color when stopped
    $clear = @{
        command = "clear"
        priority = 50
    } | ConvertTo-Json -Compress

    try {
        Invoke-RestMethod -Uri $Url `
            -Method Post `
            -ContentType "application/json" `
            -Body $clear | Out-Null
    }
    catch {
        Write-Host "Could not clear test color"
    }
}
