// Ravyn Companion (Windows) — a tray app that runs in the user's session.
// Shows branded notifications on behalf of the SYSTEM agent (which can't reach
// the user session), and lets the user request access to a blocked app.
// WinForms, no external packages — builds with just the .NET SDK.

using System.Drawing;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Windows.Forms;

namespace RavynCompanion;

static class Program
{
    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new TrayContext());
    }
}

// Matches the agent's paths on Windows (DATA_DIR = C:\Ravyn).
static class Paths
{
    public const string Portal = "https://appcontroller.vercel.app";
    public const string DeviceId = @"C:\Ravyn\.device_id";
    public const string Spool = @"C:\Ravyn\notify";
    public static readonly string Heartbeat = System.IO.Path.Combine(Spool, ".companion_alive");
}

sealed class TrayContext : ApplicationContext
{
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };
    readonly NotifyIcon _tray;
    readonly System.Windows.Forms.Timer _timer;

    public TrayContext()
    {
        _tray = new NotifyIcon
        {
            Icon = LoadIcon(),
            Text = "Ravyn",
            Visible = true,
            ContextMenuStrip = BuildMenu(),
        };

        _timer = new System.Windows.Forms.Timer { Interval = 2000 };
        _timer.Tick += (_, _) => Poll();
        _timer.Start();
        Poll();
    }

    static Icon LoadIcon()
    {
        try
        {
            var path = System.IO.Path.Combine(AppContext.BaseDirectory, "ravyn.png");
            using var bmp = new Bitmap(path);
            return Icon.FromHandle(bmp.GetHicon());
        }
        catch { return SystemIcons.Application; }
    }

    ContextMenuStrip BuildMenu()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Request access…", null, (_, _) => OpenRequest());
        menu.Items.Add("Test notification", null, (_, _) => Notify("Ravyn", "This is a test notification from Ravyn."));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit Ravyn", null, (_, _) => { _tray.Visible = false; ExitThread(); });
        return menu;
    }

    void Notify(string title, string message)
    {
        _tray.BalloonTipTitle = title;
        _tray.BalloonTipText = message;
        _tray.ShowBalloonTip(5000);
    }

    // Heartbeat + consume any notifications the agent dropped in the spool.
    void Poll()
    {
        try
        {
            System.IO.Directory.CreateDirectory(Paths.Spool);
            System.IO.File.WriteAllText(Paths.Heartbeat, "alive");
            foreach (var f in System.IO.Directory.GetFiles(Paths.Spool, "*.json"))
            {
                try
                {
                    using var doc = JsonDocument.Parse(System.IO.File.ReadAllText(f));
                    var root = doc.RootElement;
                    var title = root.TryGetProperty("title", out var t) ? t.GetString() : "Ravyn";
                    var msg = root.TryGetProperty("message", out var m) ? m.GetString() : "";
                    Notify(title ?? "Ravyn", msg ?? "");
                }
                catch { }
                try { System.IO.File.Delete(f); } catch { }
            }
        }
        catch { }
    }

    static string? ReadDeviceId()
    {
        try
        {
            var s = System.IO.File.ReadAllText(Paths.DeviceId).Trim();
            return string.IsNullOrEmpty(s) ? null : s;
        }
        catch { return null; }
    }

    void OpenRequest()
    {
        var deviceId = ReadDeviceId();
        if (deviceId is null)
        {
            Notify("Ravyn", "This device isn't enrolled yet (no device id found).");
            return;
        }
        var form = new RequestForm(deviceId, Http, Notify);
        form.Show();
        form.Activate();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) { _tray.Dispose(); _timer.Dispose(); }
        base.Dispose(disposing);
    }
}

sealed record AppItem(string Id, string Name, string RequestStatus);

sealed class RequestForm : Form
{
    readonly string _deviceId;
    readonly HttpClient _http;
    readonly Action<string, string> _notify;
    readonly ComboBox _appBox = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 320 };
    readonly TextBox _reason = new() { Width = 320, PlaceholderText = "Reason (optional)" };
    readonly ComboBox _durationBox = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 320 };
    readonly Label _status = new() { AutoSize = true, ForeColor = Color.Gray, MaximumSize = new Size(320, 0) };
    readonly Button _submit = new() { Text = "Submit request", Width = 320 };
    readonly (string Label, string Value)[] _durations =
        { ("1 hour", "1h"), ("1 day", "1d"), ("1 week", "1w"), ("Permanent", "permanent") };
    List<AppItem> _apps = new();

    public RequestForm(string deviceId, HttpClient http, Action<string, string> notify)
    {
        _deviceId = deviceId; _http = http; _notify = notify;
        Text = "Request App Access";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(360, 230);

        var panel = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(20), ColumnCount = 1, RowCount = 6, AutoSize = true };
        panel.Controls.Add(new Label { Text = "App", AutoSize = true });
        panel.Controls.Add(_appBox);
        panel.Controls.Add(new Label { Text = "Duration", AutoSize = true, Margin = new Padding(0, 8, 0, 0) });
        panel.Controls.Add(_durationBox);
        panel.Controls.Add(_reason);
        panel.Controls.Add(_status);
        panel.Controls.Add(_submit);
        Controls.Add(panel);

        foreach (var d in _durations) _durationBox.Items.Add(d.Label);
        _durationBox.SelectedIndex = 0;
        _submit.Click += async (_, _) => await SubmitAsync();

        _ = LoadAsync();
    }

    void SetStatus(string text, bool enabled) { _status.Text = text; _submit.Enabled = enabled; }

    async Task LoadAsync()
    {
        SetStatus("Loading apps…", false);
        try
        {
            var resp = await _http.GetAsync($"{Paths.Portal}/api/device-request?device_id={_deviceId}");
            var res = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(res);
            if (!doc.RootElement.TryGetProperty("apps", out var appsEl))
            {
                SetStatus(doc.RootElement.TryGetProperty("error", out var err) ? err.GetString() ?? "Error" : "Unexpected response", false);
                return;
            }
            _apps = new List<AppItem>();
            foreach (var a in appsEl.EnumerateArray())
            {
                _apps.Add(new AppItem(
                    a.GetProperty("id").GetString() ?? "",
                    a.GetProperty("name").GetString() ?? "",
                    a.TryGetProperty("requestStatus", out var rs) ? rs.GetString() ?? "none" : "none"));
            }
            _appBox.Items.Clear();
            foreach (var a in _apps) _appBox.Items.Add(a.RequestStatus == "pending" ? $"{a.Name} (pending)" : a.Name);
            if (_apps.Count == 0) { SetStatus("No blocked apps to request — you're all set.", false); }
            else { _appBox.SelectedIndex = 0; SetStatus("", true); }
        }
        catch (Exception ex) { SetStatus(ex.Message, false); }
    }

    async Task SubmitAsync()
    {
        if (_appBox.SelectedIndex < 0 || _appBox.SelectedIndex >= _apps.Count) return;
        var app = _apps[_appBox.SelectedIndex];
        var duration = _durations[Math.Max(0, _durationBox.SelectedIndex)].Value;
        SetStatus("Submitting…", false);
        try
        {
            var body = JsonSerializer.Serialize(new { device_id = _deviceId, app_id = app.Id, reason = _reason.Text, duration });
            var resp = await _http.PostAsync($"{Paths.Portal}/api/device-request",
                new StringContent(body, Encoding.UTF8, "application/json"));
            var text = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(text);
            if (doc.RootElement.TryGetProperty("success", out var ok) && ok.GetBoolean())
            {
                _notify("Ravyn", $"Access request for {app.Name} sent to your administrator.");
                Close();
            }
            else
            {
                SetStatus(doc.RootElement.TryGetProperty("error", out var err) ? err.GetString() ?? "Request failed" : "Request failed", true);
            }
        }
        catch (Exception ex) { SetStatus(ex.Message, true); }
    }
}
