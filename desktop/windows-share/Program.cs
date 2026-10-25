// A minimal Windows native Share Sheet host for the original PDF bytes.
// The Electron app generates a validated PDF; this helper offers it to Windows
// through DataTransferManagerInterop (never text-only or a fake sent message).
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Windows.ApplicationModel.DataTransfer;
using Windows.Storage;

namespace PFM.WindowsShare;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Length != 2 || !Path.IsPathFullyQualified(args[0]) || !Path.IsPathFullyQualified(args[1]) ||
            !File.Exists(args[0]) ||
            !string.Equals(Path.GetExtension(args[0]), ".pdf", StringComparison.OrdinalIgnoreCase))
            return;
        try
        {
            Application.SetHighDpiMode(HighDpiMode.SystemAware);
            Application.EnableVisualStyles();
            Application.Run(new ShareHost(Path.GetFullPath(args[0]), Path.GetFullPath(args[1])));
        }
        catch (Exception ex)
        {
            MessageBox.Show("تعذر فتح نافذة مشاركة Windows. " + ex.Message,
                "Poultry Farm Management", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }
}

internal sealed class ShareHost : Form
{
    private readonly string filePath;
    private readonly string statusPath;
    private DataTransferManager? manager;
    private readonly System.Windows.Forms.Timer keepAlive = new() { Interval = 180_000 };

    public ShareHost(string file, string status)
    {
        filePath = file;
        statusPath = status;
        Text = "Poultry Farm Management — PDF Share";
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(410, 145);
        MinimumSize = new Size(410, 145);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        ShowInTaskbar = false;
        Controls.Add(new Label {
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            Text = "اختر تطبيق المشاركة من نافذة Windows.\nيمكنك إغلاق هذه النافذة بعد الانتهاء."
        });
        keepAlive.Tick += (_, _) => Close();
        Shown += (_, _) => BeginInvoke(new Action(LaunchShare));
    }

    private void LaunchShare()
    {
        try
        {
            // WinRT desktop API: never use GetForCurrentView(), which is UWP-only.
            manager = DataTransferManagerInterop.GetForWindow(Handle);
            manager.DataRequested += OnDataRequested;
            manager.TargetApplicationChosen += OnTargetApplicationChosen;
            keepAlive.Start();
            DataTransferManagerInterop.ShowShareUIForWindow(Handle);
            // Electron checks this marker before reporting the OS share dialog
            // opened. Spawning an EXE by itself is not proof of sharing.
            File.WriteAllText(statusPath, "OPENED");
        }
        catch (Exception e)
        {
            try { File.WriteAllText(statusPath, "ERROR:" + e.Message); } catch { }
            MessageBox.Show(this, "تعذر بدء مشاركة الملف: " + e.Message,
                "مشاركة PDF", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private async void OnDataRequested(DataTransferManager sender, DataRequestedEventArgs args)
    {
        // The file must be attached as a genuine IStorageItem; sharing just
        // text containing its path does not let WhatsApp, Mail, etc. access it.
        var request = args.Request;
        var deferral = request.GetDeferral();
        try
        {
            var file = await StorageFile.GetFileFromPathAsync(filePath);
            request.Data.Properties.Title = "Poultry Farm Management — PDF Report";
            request.Data.Properties.Description = Path.GetFileName(filePath);
            request.Data.RequestedOperation = DataPackageOperation.Copy;
            request.Data.SetStorageItems(new List<IStorageItem> { file }, true);
        }
        catch (Exception e)
        {
            request.FailWithDisplayText("تعذر إرفاق ملف PDF: " + e.Message);
        }
        finally
        {
            deferral.Complete();
        }
    }

    private void OnTargetApplicationChosen(DataTransferManager sender, TargetApplicationChosenEventArgs args)
    {
        // A chosen target is NOT a confirmed transfer. Allow the receiver time
        // to read the PDF; the host closes only after its retention timer.
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        keepAlive.Stop();
        keepAlive.Dispose();
        if (manager != null)
        {
            manager.DataRequested -= OnDataRequested;
            manager.TargetApplicationChosen -= OnTargetApplicationChosen;
        }
        base.OnFormClosed(e);
    }
}
