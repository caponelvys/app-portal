// Ravyn Companion (macOS) — a menu-bar app that runs in the user's session.
// It (1) shows branded notifications on behalf of the SYSTEM agent (which can't),
// and (2) lets the user request access to a blocked app. AppKit, no Xcode project:
// built by build.sh into Ravyn.app and ad-hoc signed for local testing.

import AppKit
import UserNotifications

let PORTAL = "https://appcontroller.vercel.app"
// The agent (root) writes these. .device_id identifies the device to the API;
// the notify spool is where the agent drops notification requests for us to show.
let DEVICE_ID_PATH = "/usr/local/ravyn/.device_id"
let NOTIFY_SPOOL   = "/usr/local/ravyn/notify"

func readDeviceId() -> String? {
    guard let s = try? String(contentsOfFile: DEVICE_ID_PATH, encoding: .utf8) else { return nil }
    let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
    return t.isEmpty ? nil : t
}

// MARK: - API

// Lets us use plain error message strings as a Result failure type.
extension String: @retroactive Error {}

struct RequestableApp: Decodable {
    let id: String
    let name: String
    let description: String?
    let requestStatus: String
}

enum API {
    static func fetchApps(deviceId: String, _ done: @escaping (Result<[RequestableApp], String>) -> Void) {
        var comps = URLComponents(string: "\(PORTAL)/api/device-request")!
        comps.queryItems = [URLQueryItem(name: "device_id", value: deviceId)]
        var req = URLRequest(url: comps.url!); req.timeoutInterval = 20
        URLSession.shared.dataTask(with: req) { data, _, err in
            DispatchQueue.main.async {
                if let err = err { return done(.failure(err.localizedDescription)) }
                guard let data = data,
                      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                else { return done(.failure("Unexpected response")) }
                if let appsAny = obj["apps"],
                   let appsData = try? JSONSerialization.data(withJSONObject: appsAny),
                   let list = try? JSONDecoder().decode([RequestableApp].self, from: appsData) {
                    done(.success(list))
                } else {
                    done(.failure((obj["error"] as? String) ?? "Unexpected response"))
                }
            }
        }.resume()
    }

    static func submit(deviceId: String, appId: String, reason: String, duration: String,
                       _ done: @escaping (Result<Void, String>) -> Void) {
        var req = URLRequest(url: URL(string: "\(PORTAL)/api/device-request")!)
        req.httpMethod = "POST"; req.timeoutInterval = 20
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "device_id": deviceId, "app_id": appId, "reason": reason, "duration": duration,
        ])
        URLSession.shared.dataTask(with: req) { data, _, err in
            DispatchQueue.main.async {
                if let err = err { return done(.failure(err.localizedDescription)) }
                let obj = data.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
                if (obj?["success"] as? Bool) == true { done(.success(())) }
                else { done(.failure((obj?["error"] as? String) ?? "Request failed")) }
            }
        }.resume()
    }
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    private var statusItem: NSStatusItem!
    private var requestWC: RequestWindowController?
    private var spoolTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = Self.menuBarIcon()
            button.image?.isTemplate = false
        }
        let menu = NSMenu()
        menu.addItem(withTitle: "Request access…", action: #selector(openRequest), keyEquivalent: "")
        menu.addItem(withTitle: "Test notification", action: #selector(testNotification), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Ravyn", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        menu.items.forEach { $0.target = self }
        statusItem.menu = menu

        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .sound]) { _, _ in }

        startSpoolWatcher()
    }

    // Small icon for the menu bar — the Ravyn app icon (falls back to an SF Symbol).
    static func menuBarIcon() -> NSImage {
        if let path = Bundle.main.path(forResource: "AppIcon", ofType: "icns"),
           let img = NSImage(contentsOfFile: path) {
            img.size = NSSize(width: 18, height: 18)
            return img
        }
        return NSImage(systemSymbolName: "diamond.fill", accessibilityDescription: "Ravyn")
            ?? NSImage()
    }

    // MARK: notifications
    func postNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        let req = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req)
    }

    // Show banners even while the app is frontmost.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler handler: @escaping (UNNotificationPresentationOptions) -> Void) {
        handler([.banner, .sound])
    }

    @objc private func testNotification() {
        postNotification(title: "Ravyn", body: "This is a test notification from Ravyn.")
    }

    // MARK: agent → companion spool
    private func startSpoolWatcher() {
        spoolTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            // Heartbeat: tells the agent the companion is alive, so it routes
            // notifications here (branded) instead of plain osascript.
            try? "alive".write(toFile: NOTIFY_SPOOL + "/.companion_alive", atomically: true, encoding: .utf8)
            guard let files = try? FileManager.default.contentsOfDirectory(atPath: NOTIFY_SPOOL)
            else { return }
            for f in files where f.hasSuffix(".json") {
                let full = NOTIFY_SPOOL + "/" + f
                if let data = FileManager.default.contents(atPath: full),
                   let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    self.postNotification(title: obj["title"] as? String ?? "Ravyn",
                                          body: obj["message"] as? String ?? "")
                }
                try? FileManager.default.removeItem(atPath: full)
            }
        }
    }

    // MARK: request window
    @objc private func openRequest() {
        if requestWC == nil {
            requestWC = RequestWindowController(onNotify: { [weak self] t, b in self?.postNotification(title: t, body: b) })
        }
        NSApp.activate(ignoringOtherApps: true)
        requestWC?.showWindow(nil)
        requestWC?.window?.makeKeyAndOrderFront(nil)
        requestWC?.reload()
    }
}

// A simple window: app picker + reason + duration + submit.
final class RequestWindowController: NSWindowController {
    private let onNotify: (String, String) -> Void
    private let appPopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private let reasonField = NSTextField(string: "")
    private let durationPopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private let statusLabel = NSTextField(labelWithString: "")
    private let submit = NSButton(title: "Submit request", target: nil, action: nil)
    private var apps: [RequestableApp] = []
    private let durations: [(String, String)] = [("1 hour", "1h"), ("1 day", "1d"), ("1 week", "1w"), ("Permanent", "permanent")]

    init(onNotify: @escaping (String, String) -> Void) {
        self.onNotify = onNotify
        let win = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 420, height: 240),
                           styleMask: [.titled, .closable], backing: .buffered, defer: false)
        win.title = "Request app access"
        win.center()
        super.init(window: win)
        buildUI()
    }
    required init?(coder: NSCoder) { fatalError() }

    private func row(_ label: String, _ control: NSView) -> NSStackView {
        let l = NSTextField(labelWithString: label); l.alignment = .right
        l.widthAnchor.constraint(equalToConstant: 80).isActive = true
        let s = NSStackView(views: [l, control]); s.spacing = 10
        control.setContentHuggingPriority(.defaultLow, for: .horizontal)
        return s
    }

    private func buildUI() {
        reasonField.placeholderString = "Reason (optional)"
        durations.forEach { durationPopup.addItem(withTitle: $0.0) }
        statusLabel.textColor = .secondaryLabelColor
        statusLabel.font = .systemFont(ofSize: 11)
        submit.bezelStyle = .rounded
        submit.keyEquivalent = "\r"
        submit.target = self
        submit.action = #selector(onSubmit)

        let stack = NSStackView(views: [
            row("App", appPopup),
            row("Reason", reasonField),
            row("Duration", durationPopup),
            statusLabel,
            NSStackView(views: [NSView(), submit]),
        ])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 14
        stack.edgeInsets = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        window?.contentView?.addSubview(stack)
        if let cv = window?.contentView {
            NSLayoutConstraint.activate([
                stack.leadingAnchor.constraint(equalTo: cv.leadingAnchor),
                stack.trailingAnchor.constraint(equalTo: cv.trailingAnchor),
                stack.topAnchor.constraint(equalTo: cv.topAnchor),
            ])
        }
    }

    func reload() {
        guard let deviceId = readDeviceId() else {
            setStatus("No device_id found at \(DEVICE_ID_PATH). Is the Ravyn agent installed?", enabled: false)
            return
        }
        setStatus("Loading apps…", enabled: false)
        appPopup.removeAllItems()
        API.fetchApps(deviceId: deviceId) { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let msg): self.setStatus(msg, enabled: false)
            case .success(let list):
                self.apps = list
                if list.isEmpty {
                    self.setStatus("No blocked apps to request — you're all set.", enabled: false)
                } else {
                    list.forEach { self.appPopup.addItem(withTitle: $0.requestStatus == "pending" ? "\($0.name) (pending)" : $0.name) }
                    self.setStatus("", enabled: true)
                }
            }
        }
    }

    private func setStatus(_ text: String, enabled: Bool) {
        statusLabel.stringValue = text
        submit.isEnabled = enabled
    }

    @objc private func onSubmit() {
        guard let deviceId = readDeviceId(), appPopup.indexOfSelectedItem >= 0,
              appPopup.indexOfSelectedItem < apps.count else { return }
        let app = apps[appPopup.indexOfSelectedItem]
        let duration = durations[max(0, durationPopup.indexOfSelectedItem)].1
        setStatus("Submitting…", enabled: false)
        API.submit(deviceId: deviceId, appId: app.id, reason: reasonField.stringValue, duration: duration) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success:
                self.onNotify("Ravyn", "Access request for \(app.name) sent to your administrator.")
                self.window?.close()
            case .failure(let msg):
                self.setStatus(msg, enabled: true)
            }
        }
    }
}

// MARK: - main

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // menu-bar only, no Dock icon
let delegate = AppDelegate()
app.delegate = delegate
app.run()
