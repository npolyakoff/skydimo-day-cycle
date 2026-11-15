# Verify that forcibly killing the parent also kills its harmless PowerShell child.
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
$testExePath = Join-Path ([IO.Path]::GetTempPath()) ('HyperHDR-Job-Test-' + [Guid]::NewGuid().ToString('N') + '.exe')
$parentProcess = $null
$childProcess = $null
try {
    & $compiler /nologo /target:exe /platform:anycpu /main:HyperHDRJobTest /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$testExePath" (Join-Path $repositoryRoot 'scripts\HyperHDR-DayCycle-Launcher.cs') (Join-Path $PSScriptRoot 'HyperHDR-Job-Test.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Lifetime harness compilation failed.' }
    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = $testExePath
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $parentProcess = [Diagnostics.Process]::Start($startInfo)
    $lineTask = $parentProcess.StandardOutput.ReadLineAsync()
    if (-not $lineTask.Wait(10000)) { throw 'Timed out starting lifetime harness.' }
    $childId = 0
    if (-not [int]::TryParse($lineTask.Result, [ref]$childId)) {
        throw ('No child PID: ' + $parentProcess.StandardError.ReadToEnd())
    }
    $childProcess = [Diagnostics.Process]::GetProcessById($childId)
    if ($childProcess.WaitForExit(200)) { throw 'Child exited before parent termination.' }
    $parentProcess.Kill()
    if (-not $parentProcess.WaitForExit(5000)) { throw 'Parent did not exit.' }
    if (-not $childProcess.WaitForExit(5000)) { throw 'Child survived forced parent termination.' }
    Write-Output 'Passed: forcibly terminating the parent terminates its PowerShell child through the Windows job. No lighting commands.'
}
finally {
    foreach ($process in @($parentProcess, $childProcess)) {
        if ($null -ne $process) {
            try { if (-not $process.HasExited) { $process.Kill(); $null = $process.WaitForExit(5000) } }
            finally { $process.Dispose() }
        }
    }
    if (Test-Path -LiteralPath $testExePath) { Remove-Item -LiteralPath $testExePath }
}
