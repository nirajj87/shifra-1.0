using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

internal static class Program
{
    private const int Port = 5174;
    private const string AppUrl = "http://127.0.0.1:5174/shifra/";

    [STAThread]
    private static void Main()
    {
        try
        {
            var shipraDir = FindShipraDir();
            if (shipraDir == null)
            {
                MessageBox.Show(
                    "Shifra folder nahi mili. Ye exe ko project ke andar rakho (shipra\\desktop\\Shifra.exe).",
                    "Shifra",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            if (!PortReady())
            {
                var npm = FindNpm(shipraDir);
                if (npm == null)
                {
                    MessageBox.Show(
                        "Node.js/npm nahi mila. Pehle Node.js install karo, phir Shifra.exe dubara chalao.",
                        "Shifra",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                    return;
                }

                StartDevServer(shipraDir, npm);
                if (!WaitForServer())
                {
                    MessageBox.Show(
                        "Shifra start nahi ho payi. Check karo Node.js install hai aur port 5174 khali hai.",
                        "Shifra",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                    return;
                }
            }

            var browser = FindBrowser();
            if (browser == null)
            {
                Process.Start(AppUrl);
                return;
            }

            var profile = Path.Combine(shipraDir, "desktop", ".edge-profile");
            Directory.CreateDirectory(profile);
            var app = new ProcessStartInfo
            {
                FileName = browser,
                Arguments = "--app=" + AppUrl +
                    " --user-data-dir=\"" + profile + "\" --no-first-run --new-window",
                UseShellExecute = false
            };
            using (var window = Process.Start(app))
            {
                if (window != null) window.WaitForExit();
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Shifra", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static string FindShipraDir()
    {
        var start = AppDomain.CurrentDomain.BaseDirectory;
        var dir = new DirectoryInfo(start);
        for (var i = 0; i < 6 && dir != null; i++, dir = dir.Parent)
        {
            var candidate = dir.FullName;
            if (File.Exists(Path.Combine(candidate, "package.json")) &&
                File.Exists(Path.Combine(candidate, "vite.config.ts")))
            {
                return candidate;
            }
            var nested = Path.Combine(candidate, "shipra");
            if (File.Exists(Path.Combine(nested, "package.json")) &&
                File.Exists(Path.Combine(nested, "vite.config.ts")))
            {
                return nested;
            }
        }
        return null;
    }

    private static string FindNpm(string shipraDir)
    {
        var cmd = Path.Combine(Environment.SystemDirectory, "cmd.exe");
        try
        {
            var info = new ProcessStartInfo
            {
                FileName = cmd,
                Arguments = "/c where npm.cmd",
                WorkingDirectory = shipraDir,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true
            };
            using (var proc = Process.Start(info))
            {
                var output = proc.StandardOutput.ReadLine();
                proc.WaitForExit(4000);
                if (!string.IsNullOrWhiteSpace(output) && File.Exists(output.Trim()))
                    return output.Trim();
            }
        }
        catch
        {
            /* ignore */
        }
        return null;
    }

    private static void StartDevServer(string shipraDir, string npm)
    {
        var info = new ProcessStartInfo
        {
            FileName = Path.Combine(Environment.SystemDirectory, "cmd.exe"),
            Arguments = "/c npm run dev -- --host 127.0.0.1 --port " + Port + " --strictPort",
            WorkingDirectory = shipraDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };
        Process.Start(info);
    }

    private static bool PortReady()
    {
        try
        {
            var req = (HttpWebRequest)WebRequest.Create(AppUrl);
            req.Timeout = 800;
            req.ReadWriteTimeout = 800;
            using (var res = (HttpWebResponse)req.GetResponse())
            {
                return (int)res.StatusCode < 500;
            }
        }
        catch
        {
            return false;
        }
    }

    private static bool WaitForServer()
    {
        for (var i = 0; i < 40; i++)
        {
            Thread.Sleep(500);
            if (PortReady()) return true;
        }
        return false;
    }

    private static string FindBrowser()
    {
        var pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] paths =
        {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe")
        };
        foreach (var path in paths)
        {
            if (File.Exists(path)) return path;
        }
        return null;
    }
}
