// config.js — Lightning Fleet Tracker v2 configuration
// Loaded before content.js via manifest content_scripts ordering

const LIGHTNING_CONFIG = {
  githubRepo: "LightningJD/fleet-dashboard",
  githubPath: "live-captures.json", // FIX 1: NOT data.json — separate pipeline
  githubBranch: "main",
  // Token is set via popup and stored in chrome.storage.local under "github_token"
  pushIntervalMinutes: 5,
  // Console prefix for all logs
  logPrefix: "[Lightning Fleet]",
  // Max captures per day (anti-bloat)
  maxCapturesPerDay: 500,
  // Keywords to detect in JSON responses (checked at any depth via string match)
  relevantKeywords:
    /listing|vehicle|availability|calendar|booked|price|dailyRate|search|trip|carDetails|rental|host|insurance|delivery/i,
  // URLs we care about (broad — we also check response content)
  urlFilter: /turo\.com|graphql|api\./i,
};
