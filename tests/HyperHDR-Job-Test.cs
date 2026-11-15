using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

// Console-only lifetime harness: no WinForms, HyperHDR or lighting requests.
internal static class HyperHDRJobTest
{
    private static void Main()
    {
        HyperHDRLauncher.BindProcessLifetime();
        HyperHDRLauncher.BindProcessLifetime(); // Rebinding is harmless.
        using (Process child = Process.Start(new ProcessStartInfo
        {
            FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe"),
            Arguments = "-NoProfile -NonInteractive -Command \"Start-Sleep -Seconds 120\"",
            UseShellExecute = false,
            CreateNoWindow = true
        }))
        {
            Console.WriteLine(child.Id);
            Console.Out.Flush();
            Thread.Sleep(120000);
        }
    }
}
