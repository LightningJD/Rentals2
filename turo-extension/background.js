// background.js — Service Worker for Lightning Fleet Tracker v2
// Fixes: live-captures.json pipeline, Unicode base64, incremental push,
//        SHA conflict retry, proper state persistence, dedup, cleanup

// ════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════
const GITHUB_REPO = "LightningJD/fleet-dashboard";
const GITHUB_PATH = "live-captures.json"; // FIX 1: NOT data.json
const GITHUB_BRANCH = "main";
const PUSH_INTERVAL_MINUTES = 5;
const ALARM_NAME = "lightning-push";
const CLEANUP_ALARM = "lightning-cleanup";
const MAX_CAPTURES_PER_DAY = 500;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DEDUP_WINDOW_MS = 5000; // 5 second dedup window

// ════════════════════════════════════════════════
// In-memory state (mirrored to storage on every change)
// ════════════════════════════════════════════════
let captureCount = 0;
let lastCaptureUrl = null;
let lastCaptureTime = null;
let lastPushTime = null;
let lastPushStatus = null; // "success" | "error" | null
let lastPushedCaptureId = 0; // FIX 6: Track for incremental push
let sessionStart = Date.now();
let captureIdCounter = 0; // Monotonic counter for capture IDs

// ════════════════════════════════════════════════
// FIX 7: Persist ALL state to chrome.storage.local
// Service workers die after ~30s idle — no in-memory only state
// ════════════════════════════════════════════════
async function persistState() {
  try {
    await chrome.storage.local.set({
      session_state: {
        captureCount,
        lastCaptureUrl,
        lastCaptureTime,
        lastPushTime,
        lastPushStatus,
        lastPushedCaptureId,
        captureIdCounter,
        sessionStart,
      },
    });
  } catch (e) {
    console.warn("[Lightning Fleet BG] persistState error:", e);
  }
}

// Restore state from storage on startup
async function restoreState() {
  try {
    const result = await chrome.storage.local.get("session_state");
    if (result.session_state) {
      const s = result.session_state;
      captureCount = s.captureCount || 0;
      lastCaptureUrl = s.lastCaptureUrl || null;
      lastCaptureTime = s.lastCaptureTime || null;
      lastPushTime = s.lastPushTime || null;
      lastPushStatus = s.lastPushStatus || null;
      lastPushedCaptureId = s.lastPushedCaptureId || 0;
      captureIdCounter = s.captureIdCounter || 0;
      sessionStart = s.sessionStart || Date.now();
    }
    console.log("[Lightning Fleet BG] State restored:", {
      captureCount,
      lastPushedCaptureId,
      lastPushStatus,
    });
  } catch (e) {
    console.warn("[Lightning Fleet BG] restoreState error:", e);
  }
}

// ════════════════════════════════════════════════
// FIX 5: Proper Unicode-safe base64 encoding
// ════════════════════════════════════════════════
function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ════════════════════════════════════════════════
// Helper: get today's date key
// ════════════════════════════════════════════════
function getDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ════════════════════════════════════════════════
// Helper: get all captures from storage (all dates)
// ════════════════════════════════════════════════
async function getAllCaptures() {
  const all = await chrome.storage.local.get(null);
  const captureKeys = Object.keys(all).filter((k) => k.startsWith("captures_"));
  const captures = [];
  for (const key of captureKeys) {
    const dayCaptures = all[key] || [];
    captures.push(...dayCaptures);
  }
  return captures;
}

// ════════════════════════════════════════════════
// Helper: get captures for a specific date
// ════════════════════════════════════════════════
async function getCaptures(dateKey) {
  const key = `captures_${dateKey}`;
  const result = await chrome.storage.local.get(key);
  return result[key] || [];
}

// ════════════════════════════════════════════════
// Helper: save captures for a specific date
// ════════════════════════════════════════════════
async function saveCaptures(dateKey, captures) {
  const key = `captures_${dateKey}`;
  await chrome.storage.local.set({ [key]: captures });
}

// ════════════════════════════════════════════════
// FIX 8: GitHub GET — get current file SHA + content
// ════════════════════════════════════════════════
async function getGitHubFile(token) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=${GITHUB_BRANCH}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (resp.status === 404) {
    return { sha: null, content: null };
  }

  if (!resp.ok) {
    throw new Error(`GitHub GET failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  return { sha: data.sha, content: data.content };
}

// ════════════════════════════════════════════════
// FIX 8: GitHub PUT with SHA conflict retry (3 attempts)
// ════════════════════════════════════════════════
async function putGitHubFile(token, sha, content, mergeFn) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;

  let currentSha = sha;
  let currentContent = content;

  for (let attempt = 0; attempt < 3; attempt++) {
    const body = {
      message: `chore: update live captures ${new Date().toISOString()}`,
      content: currentContent,
      branch: GITHUB_BRANCH,
    };

    if (currentSha) {
      body.sha = currentSha;
    }

    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (resp.ok) {
      return resp.json();
    }

    if (resp.status === 409) {
      // SHA conflict — someone else pushed. Re-fetch and retry.
      console.warn(`[Lightning Fleet BG] SHA conflict on attempt ${attempt + 1}, re-fetching...`);
      const fresh = await getGitHubFile(token);
      currentSha = fresh.sha;

      // Re-merge with fresh content if merge function provided
      if (mergeFn && fresh.content) {
        try {
          const existingData = JSON.parse(decodeBase64(fresh.content));
          const merged = mergeFn(existingData);
          const mergedJson = JSON.stringify(merged, null, 2);
          currentContent = encodeBase64(mergedJson);
        } catch (e) {
          console.warn("[Lightning Fleet BG] Could not parse fresh content for merge:", e);
        }
      }

      continue;
    }

    // Non-retryable error
    const errText = await resp.text();
    throw new Error(`GitHub PUT failed: ${resp.status} ${errText}`);
  }

  throw new Error("SHA conflict after 3 retries");
}

// ════════════════════════════════════════════════
// Message handler from content script / popup
// ════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "API_CAPTURE") {
    handleCapture(message)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => {
        console.warn("[Lightning Fleet BG] Capture error:", e);
        sendResponse({ ok: false, error: e.message });
      });
    return true; // async response
  }

  if (message.type === "PUSH_NOW") {
    pushToGitHub()
      .then((result) => sendResponse(result))
      .catch((e) => {
        console.error("[Lightning Fleet BG] Push error:", e);
        sendResponse({ ok: false, error: e.message });
      });
    return true;
  }

  if (message.type === "GET_STATUS") {
    sendResponse({
      active: captureCount > 0,
      captureCount,
      lastCaptureUrl,
      lastCaptureTime,
      lastPushTime,
      lastPushStatus,
      lastPushedCaptureId,
      sessionStart,
    });
    return false;
  }

  return false;
});

// ════════════════════════════════════════════════
// Handle incoming capture
// ════════════════════════════════════════════════
async function handleCapture(message) {
  const dateKey = getDateKey();
  const captures = await getCaptures(dateKey);

  // FIX: Dedup by URL+timestamp (within 5 second window)
  const now = message.timestamp || Date.now();
  const isDupe = captures.some(
    (c) =>
      c.url === message.url &&
      Math.abs(c.timestamp - now) < DEDUP_WINDOW_MS
  );

  if (isDupe) {
    console.log(`[Lightning Fleet BG] Duplicate capture skipped: ${message.url}`);
    return;
  }

  // Enforce max captures per day
  if (captures.length >= MAX_CAPTURES_PER_DAY) {
    console.warn(
      `[Lightning Fleet BG] Daily capture limit reached (${MAX_CAPTURES_PER_DAY}) — skipping`
    );
    return;
  }

  // Generate monotonic ID
  captureIdCounter++;
  const captureId = captureIdCounter;

  const capture = {
    id: `cap-${captureId}-${Date.now()}`,
    idNum: captureId,
    timestamp: now,
    url: message.url,
    type: message.captureType,
    pageUrl: message.pageUrl || null,
    operationName: message.operationName || null,
    data: message.data, // FIX 4: RAW JSON — no field extraction
  };

  captures.push(capture);
  await saveCaptures(dateKey, captures);

  // Update in-memory state
  captureCount++;
  lastCaptureUrl = message.url;
  lastCaptureTime = now;

  // Update badge
  chrome.action.setBadgeText({ text: String(captureCount) });
  chrome.action.setBadgeBackgroundColor({ color: "#00ff88" });

  // FIX 7: Persist state on EVERY change
  await persistState();

  console.log(
    `[Lightning Fleet BG] Capture #${captureCount} stored [${message.captureType}]${
      message.operationName ? " " + message.operationName : ""
    }`
  );
}

// ════════════════════════════════════════════════
// FIX 6: Main push — only push NEW captures
// ════════════════════════════════════════════════
async function pushToGitHub() {
  const tokenResult = await chrome.storage.local.get("github_token");
  const token = tokenResult.github_token;

  if (!token) {
    lastPushStatus = "error";
    await persistState();
    return { ok: false, error: "No GitHub token configured" };
  }

  // Get all captures
  const allCaptures = await getAllCaptures();

  // FIX 6: Filter to only new captures since last push
  const newCaptures = allCaptures.filter((c) => (c.idNum || 0) > lastPushedCaptureId);

  if (newCaptures.length === 0) {
    console.log("[Lightning Fleet BG] No new captures since last push — skipping");
    // Update push time even on skip, so popup shows we're alive
    lastPushTime = Date.now();
    lastPushStatus = "success";
    await persistState();
    return { ok: true, skipped: true, message: "No new captures since last push" };
  }

  console.log(
    `[Lightning Fleet BG] Pushing ${newCaptures.length} new captures (since #${lastPushedCaptureId})`
  );

  // Get current file from GitHub
  const { sha, content: existingB64 } = await getGitHubFile(token);

  // Parse existing content
  let existingData = { captures: [] };
  if (existingB64) {
    try {
      existingData = JSON.parse(decodeBase64(existingB64));
      if (!Array.isArray(existingData.captures)) {
        existingData = { captures: [], ...existingData };
      }
    } catch (e) {
      console.warn("[Lightning Fleet BG] Could not parse existing file, starting fresh");
      existingData = { captures: [] };
    }
  }

  // Merge function for SHA conflict retry
  const mergeFn = (remoteData) => {
    if (!remoteData || !Array.isArray(remoteData.captures)) {
      remoteData = { captures: [] };
    }
    // Dedupe by capture ID
    const existingIds = new Set(remoteData.captures.map((c) => c.id));
    const toAdd = newCaptures.filter((c) => !existingIds.has(c.id));
    return {
      lastUpdated: new Date().toISOString(),
      captures: [...remoteData.captures, ...toAdd],
    };
  };

  // Build merged content
  const merged = mergeFn(existingData);

  // Sort captures by timestamp
  merged.captures.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // Encode with FIX 5: proper Unicode base64
  const jsonStr = JSON.stringify(merged, null, 2);
  const newB64 = encodeBase64(jsonStr);

  // FIX 8: PUT with SHA conflict retry
  await putGitHubFile(token, sha, newB64, mergeFn);

  // Update state after successful push
  lastPushTime = Date.now();
  lastPushStatus = "success";

  // FIX 6: Track the highest pushed capture ID
  const maxPushedId = newCaptures.reduce(
    (max, c) => Math.max(max, c.idNum || 0),
    lastPushedCaptureId
  );
  lastPushedCaptureId = maxPushedId;

  // Clear today's captures to free storage (they're now on GitHub)
  // But only clear the ones we've already pushed
  const todayKey = `captures_${getDateKey()}`;
  const todayCaptures = await getCaptures(getDateKey());
  const remaining = todayCaptures.filter((c) => (c.idNum || 0) > maxPushedId);
  await chrome.storage.local.set({ [todayKey]: remaining });

  // FIX 7: Persist state
  await persistState();

  console.log(
    `[Lightning Fleet BG] Pushed ${newCaptures.length} captures to GitHub at ${new Date().toISOString()}`
  );

  return { ok: true, pushedCount: newCaptures.length, pushedAt: lastPushTime };
}

// ════════════════════════════════════════════════
// Cleanup: remove captures older than 7 days
// ════════════════════════════════════════════════
async function cleanupOldCaptures() {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const all = await chrome.storage.local.get(null);
  const captureKeys = Object.keys(all).filter((k) => k.startsWith("captures_"));

  let totalRemoved = 0;

  for (const key of captureKeys) {
    const captures = all[key] || [];
    const kept = captures.filter((c) => (c.timestamp || 0) > cutoff);
    const removed = captures.length - kept.length;

    if (removed > 0) {
      if (kept.length === 0) {
        await chrome.storage.local.remove(key);
      } else {
        await chrome.storage.local.set({ [key]: kept });
      }
      totalRemoved += removed;
    }
  }

  if (totalRemoved > 0) {
    console.log(`[Lightning Fleet BG] Cleanup: removed ${totalRemoved} captures older than 7 days`);
  }
}

// ════════════════════════════════════════════════
// Alarms: periodic push + daily cleanup
// ════════════════════════════════════════════════
chrome.alarms.create(ALARM_NAME, {
  periodInMinutes: PUSH_INTERVAL_MINUTES,
});

chrome.alarms.create(CLEANUP_ALARM, {
  periodInMinutes: 60, // Run cleanup hourly
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    // Push if we have new captures
    if (captureCount === 0) {
      console.log("[Lightning Fleet BG] Alarm fired — no captures at all");
      return;
    }

    pushToGitHub()
      .then((result) => {
        if (result.ok) {
          if (result.skipped) {
            console.log("[Lightning Fleet BG] Scheduled push: no new captures");
          } else {
            console.log("[Lightning Fleet BG] Scheduled push succeeded:", result.pushedCount, "captures");
          }
        } else {
          console.warn("[Lightning Fleet BG] Scheduled push skipped:", result.error);
        }
      })
      .catch((e) => {
        console.error("[Lightning Fleet BG] Scheduled push failed:", e);
        lastPushStatus = "error";
        persistState();
      });
    return;
  }

  if (alarm.name === CLEANUP_ALARM) {
    cleanupOldCaptures().catch((e) => {
      console.warn("[Lightning Fleet BG] Cleanup error:", e);
    });
  }
});

// ════════════════════════════════════════════════
// Lifecycle
// ════════════════════════════════════════════════
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[Lightning Fleet BG] Extension installed/updated");
  chrome.action.setBadgeText({ text: "" });
  await restoreState();
});

chrome.runtime.onStartup.addListener(async () => {
  await restoreState();
  console.log("[Lightning Fleet BG] Service worker started (onStartup)");
});

// Restore state on every service worker wake-up
// (onStartup doesn't fire on every wake from idle)
restoreState().then(() => {
  console.log("[Lightning Fleet BG] Service worker loaded — state restored");
});
