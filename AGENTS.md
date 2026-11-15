# Repository Guidelines

## Project Structure & Module Organization

This repository contains standalone Windows PowerShell scripts for controlling HyperHDR over JSON-RPC. Files are grouped by purpose:

- `scripts/HyperHDR-DayCycle.ps1`: continuous day/night lighting based on local time, interpolated RGB checkpoints, and brightness adjustments.
- `tests/HyperHDR-DayCycle-Test.ps1`: repeating accelerated preview that compresses 24 hours into 24 seconds; its brightness schedule differs from the main script.
- `tests/HyperHDR-Test.ps1`: random RGB connectivity and lighting smoke test.
- `examples/HyperHDR-SetRed.ps1`: an executable one-shot red-color request example.

Keep runtime scripts in `scripts/`, manual integration checks in `tests/`, and standalone usage examples in `examples/`. Contributor instructions remain in the root.

## Build, Test, and Development Commands

Use Windows PowerShell 5.1 or later from the repository root. No build step or dependency installation is required. Start HyperHDR before running these commands:

```powershell
powershell.exe -NoProfile -File .\scripts\HyperHDR-DayCycle.ps1
powershell.exe -NoProfile -File .\tests\HyperHDR-DayCycle-Test.ps1
powershell.exe -NoProfile -File .\tests\HyperHDR-Test.ps1
```

These commands run the real-time cycle, accelerated preview, and random-color smoke test, respectively. Each runs continuously; stop it with `Ctrl+C`. Run one controller at a time because the scripts use the same priority.

## Coding Style & Naming Conventions

Follow the existing four-space indentation and brace placement. Use descriptive PowerShell verb-noun function names, such as `Get-Brightness` and `Send-Color`, and retain the `HyperHDR-*.ps1` filename pattern. Keep endpoint, priority, and timing settings near the top of each script. Construct request bodies as hashtables and serialize them with `ConvertTo-Json`. Preserve PowerShell 5.1 compatibility. No formatter or linter configuration is present.

## Testing Guidelines

Tests are manual integration scripts; no testing framework or coverage threshold is configured. Check connectivity with the random-color script, then inspect transitions using the accelerated preview. For schedule changes, verify checkpoint colors, midnight wraparound, brightness boundaries, and RGB values within 0–255. Confirm error reporting when HyperHDR is unavailable and priority clearing when test scripts stop. The accelerated preview does not prove the main script's exact schedule.

## Commit & Pull Request Guidelines

Git history is unavailable in this checkout, so no existing commit convention can be verified. Use concise, imperative messages such as `Fix midnight color interpolation`. Describe changed behavior, affected scripts, and manual validation in pull requests. Include timing or RGB examples for schedule changes and link relevant issues.