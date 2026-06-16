// popup.js — Lightning Fleet Tracker v2 popup logic

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const els = {
    statusDot: $("statusDot"),
    statusText: $("statusText"),
    captureCount: $("captureCount"),
    lastCapture: $("lastCapture"),
    githubDot: $("githubDot"),
    githubStatus: $("githubStatus"),
    lastPushTime: $("lastPushTime"),
    tokenInput: $("tokenInput"),
    saveToken: $("saveToken"),
    pushNow: $("pushNow"),
    viewLogs: $("viewLogs"),
    toast: $("toast"),
  };

  let isPushing = false;

  // ════════════════════════════════════════════════
  // Helper: time ago
  // ════════════════════════════════════════════════
  function timeAgo(ts) {
    if (!ts) return "—";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 0) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ════════════════════════════════════════════════
  // Helper: show toast
  // ════════════════════════════════════════════════
  function showToast(msg, type = "success") {
    els.toast.textContent = msg;
    els.toast.className = `toast show ${type}`;
    setTimeout(() => {
      els.toast.className = "toast";
    }, 3000);
  }

  // ════════════════════════════════════════════════
  // Refresh status display
  // ════════════════════════════════════════════════
  async function refreshStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
      if (!response) return;

      // Active indicator
      if (response.active) {
        els.statusDot.className = "status-dot active";
        els.statusText.textContent = "Active";
      } else {
        els.statusDot.className = "status-dot idle";
        els.statusText.textContent = "Idle";
      }

      // Capture count
      els.captureCount.textContent = String(response.captureCount || 0);

      // Last capture
      if (response.lastCaptureUrl) {
        let shortUrl = response.lastCaptureUrl;
        // Shorten URLs for display
        if (shortUrl.length > 35) {
          shortUrl = shortUrl.substring(0, 35) + "…";
        }
        els.lastCapture.textContent = `${shortUrl} (${timeAgo(response.lastCaptureTime)})`;
        els.lastCapture.title = response.lastCaptureUrl + "\n" + timeAgo(response.lastCaptureTime);
      } else {
        els.lastCapture.textContent = "—";
        els.lastCapture.title = "";
      }

      // Last push time
      els.lastPushTime.textContent = timeAgo(response.lastPushTime);

      // GitHub status
      const tokenSet = await chrome.storage.local.get("github_token");
      if (!tokenSet.github_token) {
        els.githubDot.className = "status-dot idle";
        els.githubStatus.textContent = "Not configured";
      } else if (isPushing) {
        els.githubDot.className = "status-dot pushing";
        els.githubStatus.textContent = "Pushing…";
      } else if (response.lastPushStatus === "success") {
        els.githubDot.className = "status-dot connected";
        els.githubStatus.textContent = "Connected";
      } else if (response.lastPushStatus === "error") {
        els.githubDot.className = "status-dot error";
        els.githubStatus.textContent = "Error — check console";
      } else {
        els.githubDot.className = "status-dot idle";
        els.githubStatus.textContent = "Ready";
      }
    } catch (e) {
      // Service worker might be starting up — show idle
      els.statusDot.className = "status-dot idle";
      els.statusText.textContent = "Starting…";
    }
  }

  // ════════════════════════════════════════════════
  // Save token
  // ════════════════════════════════════════════════
  els.saveToken.addEventListener("click", async () => {
    const token = els.tokenInput.value.trim();
    if (!token) {
      showToast("Enter a token first", "error");
      return;
    }

    // Validate token format (basic check)
    if (token.length < 20) {
      showToast("Token looks too short — check it's valid", "error");
      return;
    }

    await chrome.storage.local.set({ github_token: token });
    els.tokenInput.value = "";
    showToast("Token saved ✓");
    refreshStatus();
  });

  // ════════════════════════════════════════════════
  // Push now
  // ════════════════════════════════════════════════
  els.pushNow.addEventListener("click", async () => {
    if (isPushing) return;

    isPushing = true;
    els.pushNow.disabled = true;
    els.pushNow.textContent = "Pushing…";
    els.githubDot.className = "status-dot pushing";
    els.githubStatus.textContent = "Pushing…";

    try {
      const result = await chrome.runtime.sendMessage({ type: "PUSH_NOW" });
      if (result && result.ok) {
        if (result.skipped) {
          showToast("No new captures to push", "info");
        } else {
          showToast(`Pushed ${result.pushedCount || ""} captures ✓`);
        }
      } else {
        showToast(result?.error || "Push failed", "error");
      }
    } catch (e) {
      showToast("Push failed: " + (e.message || "unknown error"), "error");
    } finally {
      isPushing = false;
      els.pushNow.disabled = false;
      els.pushNow.textContent = "Push Now";
      refreshStatus();
    }
  });

  // ════════════════════════════════════════════════
  // View logs — open DevTools on the active tab
  // ════════════════════════════════════════════════
  els.viewLogs.addEventListener("click", async () => {
    try {
      // Try to open the inspect view for the service worker
      await chrome.tabs.create({
        url: "chrome://extensions/?id=" + chrome.runtime.id,
      });
      showToast("Open 'Service Worker' → Console for logs", "info");
    } catch (e) {
      // Fallback: open the extensions page
      chrome.tabs.create({ url: "chrome://extensions/" });
    }
  });

  // ════════════════════════════════════════════════
  // Enter key to save token
  // ════════════════════════════════════════════════
  els.tokenInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      els.saveToken.click();
    }
  });

  // ════════════════════════════════════════════════
  // Init
  // ════════════════════════════════════════════════
  refreshStatus();

  // Refresh every 5 seconds while popup is open
  const refreshInterval = setInterval(refreshStatus, 5000);

  // Clean up interval on unload
  window.addEventListener("unload", () => {
    clearInterval(refreshInterval);
  });
})();
