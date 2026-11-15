# Repository Guidelines

## Project Structure

This project is a buildless local HTML editor for HyperHDR schedules, with a downloadable Windows EXE launcher and standalone PowerShell examples.

- `app/index.html`, `app/style.css`: Russian-language UI and styling; open the HTML directly in a browser.
- `app/theme.js`: system/light/dark theme preference, loaded before CSS. Default to system, follow OS changes, persist manual preference, and theme charts/dialogs through CSS variables.
- `app/app.js`: schedule editing, interpolation, localStorage, connection checks, playback orchestration, and EXE/PowerShell generation.
- `app/live-control.js`: persistent WebSocket controller for real lighting playback.
- `app/launcher-template.js`: generated base64 Windows executable template. Never edit its binary content by hand.
- `scripts/HyperHDR-DayCycle-Launcher.cs`: .NET Framework Windows launcher, optional tray icon, single-instance mutex, and `--stop` signal.
- `scripts/HyperHDR-BuildLauncher.ps1`: builds the C# launcher and regenerates the browser template.
- `scripts/HyperHDR-DayCycle.ps1`: standalone real-time lighting controller.
- `tests/HyperHDR-Connection-Test.js`: mocked browser connection checks, including automatic startup checking.
- `tests/HyperHDR-LiveControl-Test.js`: mocked controller and playback checks.
- `tests/HyperHDR-Exe-Test.js`: executable packaging, endpoint validation, and embedded-script checks.
- `tests/HyperHDR-Startup-Test.ps1`: exported-script readiness/restart checks with mocked requests and sleeps; no hardware access.
- `tests/HyperHDR-Job-Test.ps1` and `.cs`: console-only Windows process-lifetime test; forcibly kills its own helper to verify automatic cleanup of its harmless PowerShell child.
- `tests/HyperHDR-DayCycle-Test.ps1`: manual accelerated hardware test with its own brightness schedule.
- `examples/HyperHDR-SetRed.ps1`: one-shot color example.

Keep browser assets in `app/`, runtime/build sources in `scripts/`, checks in `tests/`, and examples in `examples/`. Keep root and app READMEs consistent with the actual interface.

## Current Product Behavior

- The app runs from `file://`. No Node server, package installation, hosting, or bundler is needed for users.
- The default endpoint is `http://localhost:8099/`. Validate HTTP(S) addresses and normalize `/json-rpc` for exported scripts.
- Browser communication uses WS/WSS on the configured web port, avoiding HTTP fetch CORS failures. Do not replace it with direct cross-origin fetch or require users to disable browser security.
- On DOMContentLoaded, check `serverinfo` once using the saved address. Checking is read-only and must never start lighting playback.
- Brightness interpolation is linear; color interpolation uses RGB smoothstep. Preserve midnight wraparound and RGB bounds.
- The chart cursor selects time. Editing controls can create/update points at that minute without duplicates.
- Play-day mode controls real LEDs: a repeating 24-second cycle from the selected minute. Use priority 50, bounded request frequency, one color request in flight, renewed finite color leases, and `clear` on stop.
- Pause, manual timeline selection, endpoint changes, hidden/page exit, and switching to the instructions stop playback. Connection failures stop playback with an error.
- Store settings in browser localStorage. There are no preset files, JSON settings import/export, or directory selection workflows. JSON serialization is still necessary for localStorage and HyperHDR RPC.
- The EXE dialog contains the tray option. Only `HyperHDR-DayCycle.exe` is downloadable; it uses the computer's local time. There is no test EXE download. The PowerShell download button is intentionally hidden; retain its implementation unless asked to remove it.
- The embedded script waits for a successful `serverinfo` response with an info object at the configured HTTP endpoint before sending color. Retry readiness after 2 seconds, with a 3-second request timeout. Color-command failure returns it to waiting. Never clear a priority that has not been acquired. The EXE process may start before HyperHDR; lighting starts after API readiness.
- Bind the launcher to a non-inherited Windows job with KILL_ON_JOB_CLOSE before creating PowerShell. Keep its handle for the entire EXE lifetime so forced EXE termination also terminates descendants. Fail closed if job creation/assignment fails; parent-child PID relationships alone do not provide lifetime cleanup.

## Development and Validation

Run from the repository root. Node.js is needed only for development checks; no dependencies or test framework are installed.

```powershell
node --check app/app.js
node --check app/live-control.js
node tests/HyperHDR-Connection-Test.js
node tests/HyperHDR-LiveControl-Test.js
node tests/HyperHDR-Exe-Test.js
powershell.exe -NoProfile -File .\tests\HyperHDR-Startup-Test.ps1
powershell.exe -NoProfile -File .\tests\HyperHDR-Job-Test.ps1
```

The JS checks do not contact real LEDs and do not provide visual browser or tray coverage. Test meaningful changes with the relevant commands; do not add tests that only mirror trivial markup or styling.

After C# changes, rebuild the shipped template with Windows PowerShell 5.1+ and the installed .NET Framework compiler:

```powershell
powershell.exe -NoProfile -File .\scripts\HyperHDR-BuildLauncher.ps1
node tests/HyperHDR-Exe-Test.js
```

No rebuild is needed for ordinary HTML/CSS/JS changes. Preserve the payload contract: PE template followed by UTF-8 PowerShell, uint32 little-endian byte length, and ASCII marker `HHDRPS01`. The leading `HyperHDR-ShowTray` comment controls the tray mode.

Manual hardware checks require HyperHDR and affect real lighting:

```powershell
powershell.exe -NoProfile -File .\scripts\HyperHDR-DayCycle.ps1
powershell.exe -NoProfile -File .\tests\HyperHDR-DayCycle-Test.ps1
powershell.exe -NoProfile -File .\examples\HyperHDR-SetRed.ps1
```

Run one controller at a time because priority 50 is shared. The two continuous PowerShell controllers stop with Ctrl+C. The accelerated script's independent schedule does not prove editor/export equivalence.

For playback changes, verify checkpoints, midnight, brightness boundaries, stale/cancelled connections, constant-color lease renewal, request backpressure, and clearing only the owned priority. For launcher changes, manually inspect tray/no-tray behavior, `--stop`, startup shortcuts, and exit cleanup. Report mocked checks separately from hardware or browser validation.

## Coding Conventions

Preserve surrounding style. PowerShell and C# use four-space indentation; existing JavaScript is compact vanilla JS. Keep Windows PowerShell 5.1 and .NET Framework 4.x compatibility. Use descriptive verb-noun PowerShell function names and the `HyperHDR-*.ps1` filename pattern. Keep endpoint, priority, and timing settings easy to find. Serialize PowerShell request hashtables with `ConvertTo-Json`.

Use accessible labels, visible focus states, and native dialog behavior. Keep user-facing text in Russian. Do not introduce a framework, runtime server, presets, or new dependency as part of routine edits. Avoid changing generated binaries without the matching source change and rebuild.

## Commits and Pull Requests

Use concise imperative commit messages, such as `Fix midnight color interpolation`. Describe the user-visible behavior, affected components, and checks performed. For schedule changes include timing/RGB examples. Identify limits of manual or mocked validation and link relevant issues when available. Do not commit or stage unrelated user changes.
