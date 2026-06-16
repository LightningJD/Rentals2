// content.js — Monkey-patch fetch & XHR to intercept ALL Turo API/GraphQL responses
// v2: Content-based detection (not URL-pattern matching), raw JSON pass-through
// Core principle: NEVER break Turo's functionality. Only READ responses.

(function () {
  "use strict";

  const PREFIX = LIGHTNING_CONFIG.logPrefix;
  const KEYWORDS = LIGHTNING_CONFIG.relevantKeywords;
  const URL_FILTER = LIGHTNING_CONFIG.urlFilter;
  const MAX_URL_LOG = 200; // Prevent console spam

  let loggedUrlCount = 0;

  // ════════════════════════════════════════════════
  // Helper: check if a JSON string contains relevant Turo data
  // ════════════════════════════════════════════════
  function hasRelevantData(jsonStr) {
    return KEYWORDS.test(jsonStr);
  }

  // ════════════════════════════════════════════════
  // Helper: detect if JSON is a GraphQL response
  // ════════════════════════════════════════════════
  function hasGraphQL(json) {
    if (!json || typeof json !== "object") return false;
    // GraphQL responses typically have { data: { ... } }
    if (json.data && typeof json.data === "object") return true;
    // Or { errors: [...] }
    if (Array.isArray(json.errors)) return true;
    return false;
  }

  // ════════════════════════════════════════════════
  // Helper: extract GraphQL operation name from request body
  // ════════════════════════════════════════════════
  function extractOperationName(body) {
    if (!body) return null;

    // body can be string, FormData, or object
    if (typeof body === "string") {
      const match = body.match(/"operationName"\s*:\s*"([^"]+)"/);
      if (match) return match[1];
      // Also try to parse as JSON
      try {
        const parsed = JSON.parse(body);
        if (parsed.operationName) return parsed.operationName;
      } catch {
        // not JSON, that's fine
      }
    }

    if (body instanceof URLSearchParams) {
      const op = body.get("operationName");
      if (op) return op;
    }

    if (typeof body === "object" && body !== null) {
      if (body.operationName) return String(body.operationName);
    }

    return null;
  }

  // ════════════════════════════════════════════════
  // FIX 4: Send RAW JSON to background — NO field extraction
  // The cron job handles all field mapping/extraction
  // ════════════════════════════════════════════════
  function sendCapture(url, type, rawJson, operationName) {
    try {
      const payload = {
        type: "API_CAPTURE",
        url: url,
        captureType: type, // "graphql" | "api" | "listing" | "availability" | "search"
        data: rawJson, // RAW JSON — no extraction!
        operationName: operationName || null,
        pageUrl: window.location.href,
        timestamp: Date.now(),
      };
      console.log(`${PREFIX} Capture [${type}]${operationName ? " " + operationName : ""}`, url);
      chrome.runtime.sendMessage(payload).catch((e) => {
        console.warn(`${PREFIX} Failed to send capture to background:`, e);
      });
    } catch (e) {
      console.warn(`${PREFIX} sendCapture error:`, e);
    }
  }

  // ════════════════════════════════════════════════
  // FIX 3: Process ANY JSON response — content-based detection
  // ════════════════════════════════════════════════
  function processResponse(url, json, operationName, requestBody) {
    if (!json) return;

    const jsonStr = JSON.stringify(json);

    // Check if response contains relevant Turo data
    if (!hasRelevantData(jsonStr)) return;

    // Extract operation name from request body if not already found
    if (!operationName && requestBody) {
      operationName = extractOperationName(requestBody);
    }

    // Classify type
    let type;
    if (operationName || hasGraphQL(json)) {
      type = "graphql";
    } else if (/listing/i.test(url)) {
      type = "listing";
    } else if (/availability|calendar/i.test(url)) {
      type = "availability";
    } else if (/search/i.test(url)) {
      type = "search";
    } else {
      type = "api";
    }

    // FIX 4: Send RAW JSON — let the cron job handle extraction
    sendCapture(url, type, json, operationName);
  }

  // ════════════════════════════════════════════════
  // ══ FETCH MONKEY-PATCH ══════════════════════════
  // FIX 3: Intercept ALL responses, not just pattern-matched URLs
  // ════════════════════════════════════════════════
  const originalFetch = window.fetch;

  window.fetch = function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    const requestBody = args[1]?.body;

    // Log ALL intercepted URLs (rate-limited to prevent spam)
    if (loggedUrlCount < MAX_URL_LOG) {
      console.log(`${PREFIX} fetch →`, url);
      loggedUrlCount++;
    }

    // Extract GraphQL operation name from request body
    const operationName = extractOperationName(requestBody);

    // Call original fetch normally
    const fetchPromise = originalFetch.apply(this, args);

    // FIX 3: Intercept ALL responses from Turo domains OR any JSON response
    if (url && URL_FILTER.test(url)) {
      fetchPromise
        .then((response) => {
          // Clone the response so we don't consume the original stream
          const cloned = response.clone();

          // Try to parse as JSON
          cloned
            .json()
            .then((json) => {
              // Content-based detection — check response CONTENT, not just URL
              processResponse(url, json, operationName, requestBody);
            })
            .catch(() => {
              // Not JSON or parse error — silently skip
            });
        })
        .catch(() => {
          // Network error — don't care
        });
    }

    // ALWAYS return the ORIGINAL promise (not our chained one)
    return fetchPromise;
  };

  // ════════════════════════════════════════════════
  // ══ XMLHttpRequest MONKEY-PATCH ══════════════════
  // ════════════════════════════════════════════════
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    // Store the URL and method on the XHR instance for later use
    this.__lightningUrl = url || "";
    this.__lightningMethod = method || "GET";
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const url = this.__lightningUrl || "";

    // Log ALL intercepted URLs (rate-limited)
    if (loggedUrlCount < MAX_URL_LOG) {
      console.log(`${PREFIX} XHR →`, url);
      loggedUrlCount++;
    }

    // Extract operation name from request body
    const operationName = extractOperationName(body);

    if (url && URL_FILTER.test(url)) {
      // Listen for the response
      this.addEventListener(
        "load",
        function () {
          try {
            const contentType = this.getResponseHeader("content-type") || "";
            if (
              contentType.includes("application/json") ||
              contentType.includes("text/plain") ||
              contentType.includes("application/graphql")
            ) {
              let json;
              try {
                json = JSON.parse(this.responseText);
              } catch {
                return; // Not valid JSON — skip
              }
              // Content-based detection
              processResponse(url, json, operationName, body);
            }
          } catch (e) {
            console.warn(`${PREFIX} XHR processing error:`, e);
          }
        },
        { passive: true }
      );
    }

    // Call original send normally
    return originalSend.call(this, body);
  };

  console.log(`${PREFIX} Content script v2 loaded — fetch/XHR interception active (content-based detection)`);
})();
