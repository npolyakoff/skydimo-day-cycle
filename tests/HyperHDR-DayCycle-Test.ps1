
# HyperHDR DayCycle - 24 second test

$Url = "http://localhost:8099/json-rpc"
$Priority = 50

$CycleSeconds = 24
$UpdateMs = 50

# Time checkpoints (minutes from midnight)
$Points = @(
    @{ Time = 0;    RGB = @(255,65,18) }
    @{ Time = 420;  RGB = @(220,235,255) }
    @{ Time = 780;  RGB = @(75,175,255) }
    @{ Time = 1140; RGB = @(255,170,85) }
    @{ Time = 1380; RGB = @(255,65,18) }
    @{ Time = 1440; RGB = @(255,65,18) }
)

function Get-Color([double]$minute) {
    for ($i = 0; $i -lt $Points.Count - 1; $i++) {
        $a = $Points[$i]
        $b = $Points[$i + 1]

        if ($minute -ge $a.Time -and
            $minute -le $b.Time) {

            $t = ($minute - $a.Time) /
                 ($b.Time - $a.Time)

            $t = $t * $t * (3 - 2 * $t)

            $rgb = @(
                for ($c = 0; $c -lt 3; $c++) {
                    [int][Math]::Round(
                        $a.RGB[$c] +
                        ($b.RGB[$c] - $a.RGB[$c]) * $t
                    )
                }
            )

            return ,$rgb
        }
    }
}

function Get-Brightness([double]$minute) {

    # Brightness checkpoints
    $points = @(
        @{ Time = 0;    Value = 60  }
        @{ Time = 60;   Value = 50  }
        @{ Time = 300;  Value = 50  }
        @{ Time = 480;  Value = 100 }
        @{ Time = 1080; Value = 100 }
        @{ Time = 1440; Value = 60  }
    )

    for ($i = 0; $i -lt $points.Count - 1; $i++) {

        $a = $points[$i]
        $b = $points[$i + 1]

        if ($minute -ge $a.Time -and
            $minute -le $b.Time) {

            $t = ($minute - $a.Time) /
                 ($b.Time - $a.Time)

            # Smoothstep easing
            $t = $t * $t * (3 - 2 * $t)

            return (
                $a.Value +
                ($b.Value - $a.Value) * $t
            )
        }
    }

    return 60
}

function Send-Color($rgb) {
    $body = @{
        command  = "color"
        color    = @($rgb)
        priority = $Priority
        duration = 1500
    } | ConvertTo-Json -Compress

    $response = Invoke-RestMethod `
        -Uri $Url `
        -Method Post `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 3

    if ($response.success -eq $false) {
        throw ($response | ConvertTo-Json -Compress)
    }
}

Write-Host "HyperHDR DayCycle Test"
Write-Host "24 hours = 24 seconds"
Write-Host "Press Ctrl+C to stop"
Write-Host ""

$timer = [Diagnostics.Stopwatch]::StartNew()
$lastColor = ""

try {
    while ($true) {
        $elapsed = $timer.Elapsed.TotalSeconds % $CycleSeconds

        $minute = ($elapsed / $CycleSeconds) * 1440

        $color = Get-Color $minute
        $brightness = Get-Brightness $minute

        $finalColor = @(
            foreach ($channel in $color) {
                [int][Math]::Round(
                    $channel * $brightness / 100
                )
            }
        )

        $key = $finalColor -join ","

        if ($key -ne $lastColor) {
            Send-Color $finalColor
            $lastColor = $key
        }

        $virtualHour = [int][Math]::Floor($minute / 60)
        Write-Host ("`rVirtual time: {0:00}:00 | RGB: {1} | Brightness: {2:N0}%   " -f `
            $virtualHour, $key, $brightness) -NoNewline

        Start-Sleep -Milliseconds $UpdateMs
    }
}
finally {
    $timer.Stop()

    $body = @{
        command = "clear"
        priority = $Priority
    } | ConvertTo-Json -Compress

    try {
        Invoke-RestMethod -Uri $Url `
            -Method Post `
            -ContentType "application/json" `
            -Body $body -TimeoutSec 3 | Out-Null
    }
    catch {
        Write-Host "`nCould not clear test color"
    }
}

Write-Host "`nDayCycle test completed!"
