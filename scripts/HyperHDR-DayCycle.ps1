
# HyperHDR - Smooth Day/Night Cycle
# Windows PowerShell 5.1+

$Url = "http://localhost:8099/json-rpc"
$Priority = 50
$UpdateSeconds = 1

# Color checkpoints: time and RGB
$Points = @(
    @{ Minute = 60;   RGB = @(255,65,18)  } # 01:00
    @{ Minute = 420;  RGB = @(220,235,255)} # 07:00
    @{ Minute = 780;  RGB = @(75,175,255) } # 13:00
    @{ Minute = 1140; RGB = @(255,170,85) } # 19:00
    @{ Minute = 1380; RGB = @(255,65,18)  } # 23:00
    @{ Minute = 1500; RGB = @(255,65,18)  } # Next 01:00
)

function Get-InterpolatedColor($Minute) {

    # Handle midnight wraparound
    if ($Minute -lt 60) {
        $Minute += 1440
    }

    for ($i = 0; $i -lt ($Points.Count - 1); $i++) {
        $a = $Points[$i]
        $b = $Points[$i + 1]

        if ($Minute -ge $a.Minute -and
            $Minute -le $b.Minute) {

            $t = ($Minute - $a.Minute) /
                 ($b.Minute - $a.Minute)

            # Smoothstep easing
            $t = $t * $t * (3 - 2 * $t)

            $rgb = @()

            for ($c = 0; $c -lt 3; $c++) {
                $value = $a.RGB[$c] +
                    ($b.RGB[$c] - $a.RGB[$c]) * $t

                $rgb += [int][Math]::Round($value)
            }

            return ,$rgb
        }
    }
}

function Get-Brightness($Minute) {

    # 01:00-06:00: 50%
    # 06:00-07:00: gradual rise to 100%
    # 07:00-00:00: 100%
    # 00:00-01:00: gradual drop to 50%

    if ($Minute -ge 60 -and $Minute -lt 360) {
        return 50
    }

    if ($Minute -ge 360 -and $Minute -lt 420) {
        return 50 + 50 * (($Minute - 360) / 60)
    }

    if ($Minute -ge 420) {
        return 100
    }

    return 100 - 50 * ($Minute / 60)
}

function Send-Color($RGB) {

    $body = @{
        command  = "color"
        color    = @($RGB)
        priority = $Priority
        duration = 4000
    } | ConvertTo-Json -Compress

    $response = Invoke-RestMethod `
        -Uri $Url `
        -Method Post `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 5

    if ($response.success -eq $false) {
        $details = $response | ConvertTo-Json -Compress
        throw "HyperHDR rejected command: $details"
    }
}

Write-Host "HyperHDR Day Cycle started"
Write-Host "Press Ctrl+C to stop"
Write-Host ""

$lastColor = ""

while ($true) {

    try {
        $now = Get-Date

        $minute = $now.Hour * 60 +
                  $now.Minute +
                  $now.Second / 60.0

        $color = Get-InterpolatedColor $minute
        $brightness = Get-Brightness $minute

        $finalColor = @(
            foreach ($channel in $color) {
                [int][Math]::Round(
                    $channel * $brightness / 100
                )
            }
        )

        $colorKey = $finalColor -join ","

        # Send only when RGB changes
        if ($colorKey -ne $lastColor) {

            Send-Color $finalColor
            $lastColor = $colorKey

            Write-Host (
                "{0:HH:mm:ss} | RGB: {1} | Brightness: {2:N0}%" -f `
                $now, $colorKey, $brightness
            )
        }
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
        $lastColor = ""
    }

    Start-Sleep -Seconds $UpdateSeconds
}
