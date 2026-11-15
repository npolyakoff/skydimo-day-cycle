using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading;
using System.Windows.Forms;

// The browser appends UTF-8 PowerShell, its uint32 byte length, and HHDRPS01.
internal static class HyperHDRLauncher
{
    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "--stop")
        {
            try
            {
                using (EventWaitHandle signal = EventWaitHandle.OpenExisting(@"Local\HyperHDR-DayCycle-Stop")) { signal.Set(); }
            }
            catch (WaitHandleCannotBeOpenedException) { }
            return;
        }
        bool owner;
        using (Mutex mutex = new Mutex(true, @"Local\HyperHDR-DayCycle-Exported", out owner))
        {
            if (!owner)
            {
                MessageBox.Show("HyperHDR Day Cycle is already running. Exit it from the system tray or run HyperHDR-DayCycle.exe --stop before starting another configuration.", "HyperHDR Day Cycle");
                return;
            }
            try
            {
                Application.EnableVisualStyles();
                string script = ReadScript(Application.ExecutablePath);
                using (EventWaitHandle signal = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\HyperHDR-DayCycle-Stop"))
                {
                    Application.Run(new ControllerContext(script, ShouldShowTray(script), signal));
                }
            }
            catch (Exception error)
            {
                MessageBox.Show(error.Message, "HyperHDR Day Cycle", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally { mutex.ReleaseMutex(); }
        }
    }

    internal static bool ShouldShowTray(string script)
    {
        return !script.StartsWith("# HyperHDR-ShowTray: false\n", StringComparison.Ordinal);
    }

    internal static string ReadScript(string executablePath)
    {
        using (FileStream stream = File.OpenRead(executablePath))
        using (BinaryReader reader = new BinaryReader(stream))
        {
            if (stream.Length < 12) throw new InvalidDataException("Missing schedule.");
            stream.Seek(-12, SeekOrigin.End);
            uint length = reader.ReadUInt32();
            string marker = Encoding.ASCII.GetString(reader.ReadBytes(8));
            if (marker != "HHDRPS01" || length == 0 || length > 1024 * 1024 || length > stream.Length - 12)
                throw new InvalidDataException("Invalid or missing embedded schedule. Download the EXE again from the editor.");
            stream.Seek(-12 - (long)length, SeekOrigin.End);
            return new UTF8Encoding(false, true).GetString(reader.ReadBytes((int)length));
        }
    }

    private sealed class ControllerContext : ApplicationContext
    {
        private readonly NotifyIcon tray;
        private readonly Process child;
        private readonly System.Windows.Forms.Timer timer;
        private readonly string scriptPath;
        private bool stopping;

        internal ControllerContext(string script, bool showTray, EventWaitHandle stopSignal)
        {
            string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HyperHDR-DayCycle");
            Directory.CreateDirectory(folder);
            scriptPath = Path.Combine(folder, "schedule-" + Guid.NewGuid().ToString("N") + ".ps1");
            File.WriteAllText(scriptPath, script, new UTF8Encoding(true));
            child = new Process();
            child.StartInfo = new ProcessStartInfo
            {
                FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe"),
                Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + scriptPath + "\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = folder
            };
            try { child.Start(); }
            catch { File.Delete(scriptPath); child.Dispose(); throw; }
            if (showTray)
            {
                tray = new NotifyIcon();
                tray.Icon = SystemIcons.Application;
                tray.Text = "HyperHDR Day Cycle";
                ContextMenuStrip menu = new ContextMenuStrip();
                menu.Items.Add("HyperHDR Day Cycle is running").Enabled = false;
                menu.Items.Add("Exit", null, delegate { ExitThread(); });
                tray.ContextMenuStrip = menu;
                tray.Visible = true;
            }
            timer = new System.Windows.Forms.Timer();
            timer.Interval = 1000;
            timer.Tick += delegate
            {
                if (stopSignal.WaitOne(0)) { ExitThread(); return; }
                if (!child.HasExited) return;
                int code = child.ExitCode;
                ExitThread();
                MessageBox.Show("The PowerShell controller stopped (exit code " + code + "). Try exporting and running the PowerShell script in a visible window to inspect the error.", "HyperHDR Day Cycle");
            };
            timer.Start();
            Application.ApplicationExit += OnApplicationExit;
        }

        private void OnApplicationExit(object sender, EventArgs args) { Stop(); }

        private void Stop()
        {
            if (stopping) return;
            stopping = true;
            timer.Stop();
            timer.Dispose();
            if (tray != null)
            {
                tray.Visible = false;
                tray.ContextMenuStrip.Dispose();
                tray.Dispose();
            }
            try { if (!child.HasExited) { child.Kill(); child.WaitForExit(5000); } }
            catch (InvalidOperationException) { }
            finally
            {
                child.Dispose();
                try { File.Delete(scriptPath); } catch (IOException) { } catch (UnauthorizedAccessException) { }
                Application.ApplicationExit -= OnApplicationExit;
            }
        }

        protected override void ExitThreadCore()
        {
            Stop();
            base.ExitThreadCore();
        }
    }
}
