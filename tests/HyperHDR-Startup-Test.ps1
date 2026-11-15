# Test the actual exported script without launching a controller or making network calls.
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$testExePath = Join-Path ([IO.Path]::GetTempPath()) ('HyperHDR-Startup-Test-' + [Guid]::NewGuid().ToString('N') + '.exe')
try {
    & node (Join-Path $PSScriptRoot 'HyperHDR-Exe-Test.js') $testExePath
    if ($LASTEXITCODE -ne 0) { throw 'EXE packaging checks failed.' }
    $bytes = [IO.File]::ReadAllBytes($testExePath)
    $length = [BitConverter]::ToUInt32($bytes, $bytes.Length - 12)
    $exported = [Text.Encoding]::UTF8.GetString($bytes, $bytes.Length - 12 - $length, $length)
    $tokens = $null
    $parseErrors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseInput($exported, [ref]$tokens, [ref]$parseErrors)
    if ($parseErrors.Count -gt 0) { throw ($parseErrors | Out-String) }
    # Bound only the outer loop; keep the real readiness loop and request functions.
    $bounded = $exported.Replace('try {' + "`r`n" + '    while ($true) {', 'try {' + "`r`n" + '    while ($script:KeepRunning) {')
    if ($bounded -eq $exported) { throw 'Could not bound exported main loop.' }

    $script:Events = New-Object 'System.Collections.Generic.List[string]'
    $script:KeepRunning = $true
    $script:ProbeCount = 0
    $script:ColorCount = 0
    $script:CancelWaiting = $false
    function Invoke-RestMethod($Uri, $Method, $ContentType, $Body, $TimeoutSec, $ErrorAction) {
        if ($Uri -ne 'http://localhost:8090/json-rpc') { throw 'Export ignored configured port.' }
        $request = $Body | ConvertFrom-Json
        $script:Events.Add($request.command)
        switch ($request.command) {
            'serverinfo' {
                if ($script:CancelWaiting) { throw 'Not ready' }
                $script:ProbeCount++
                switch ($script:ProbeCount) {
                    1 { throw 'Port not listening yet' }
                    2 { return [PSCustomObject]@{ success = $true; command = 'other'; info = [PSCustomObject]@{} } }
                    3 { return [PSCustomObject]@{ success = $false; command = 'serverinfo'; error = 'Not authorized' } }
                    default { return [PSCustomObject]@{ success = $true; command = 'serverinfo'; info = [PSCustomObject]@{} } }
                }
            }
            'color' {
                $script:ColorCount++
                if ($script:ColorCount -eq 1) { throw 'HyperHDR restarted' }
                if ($request.color.Count -ne 3) { throw 'Invalid RGB payload.' }
                return [PSCustomObject]@{ success = $true; command = 'color' }
            }
            'clear' { return [PSCustomObject]@{ success = $true; command = 'clear' } }
            default { throw 'Unexpected request.' }
        }
    }
    function Start-Sleep($Seconds) {
        if ($script:CancelWaiting) { throw 'Test cancelled while waiting' }
        if ($Seconds -eq 2) { $script:Events.Add('wait') }
        elseif ($Seconds -eq 1) {
            $script:Events.Add('update')
            if ($script:ColorCount -ge 2) { $script:KeepRunning = $false }
        }
        else { throw 'Unexpected interval.' }
    }
    function Write-Host($Object, $ForegroundColor) { }

    Invoke-Expression $bounded
    $expected = 'serverinfo,wait,serverinfo,wait,serverinfo,wait,serverinfo,color,update,serverinfo,color,update,clear'
    if (($script:Events -join ',') -ne $expected) { throw ('Incorrect startup/restart gate: ' + ($script:Events -join ',')) }

    $script:Events.Clear()
    $script:KeepRunning = $true
    $script:CancelWaiting = $true
    $cancelled = $false
    try { Invoke-Expression $bounded } catch { $cancelled = $true }
    if (-not $cancelled -or ($script:Events -join ',') -ne 'serverinfo') { throw 'Waiting sent color/clear or could not be cancelled.' }
    Write-Output 'Passed: configured port, startup gate, wrong service/auth rejection, restart gate, current schedule, owned-priority cleanup, stop while waiting. No network requests.'
}
finally {
    if (Test-Path -LiteralPath $testExePath) { Remove-Item -LiteralPath $testExePath }
}
