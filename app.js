"use strict";

const CONFIG = Object.freeze({
  sheetId: "1xhyDHmOjeDFh0EDZkwiQX0N-GB4DYhqu2WVtuHqKqok",
  sheetGid: "2037124561",
  refreshEveryMs: 5 * 60 * 1000,
  retryAfterMs: 45 * 1000,
  timeZone: "Europe/London"
});

const frame = document.getElementById("dashboard");
const clock = document.getElementById("clock");
const dateLabel = document.getElementById("date");
const refreshText = document.getElementById("refreshText");
const offlineBadge = document.getElementById("offlineBadge");
const connectionState = document.getElementById("connectionState");

let retryTimer = null;
let nextRefreshAt = Date.now() + CONFIG.refreshEveryMs;
let lastLoadedAt = null;

function dashboardUrl() {
  const cacheBuster = Date.now();

  return [
    `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/preview`,
    `?gid=${CONFIG.sheetGid}`,
    "&rm=minimal",
    "&widget=false",
    "&headers=false",
    `&_=${cacheBuster}`
  ].join("");
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: CONFIG.timeZone
  }).format(date);
}

function setLoading(value) {
  document.body.classList.toggle("loading", value);
}

function loadDashboard(reason = "scheduled") {
  setLoading(true);
  clearTimeout(retryTimer);

  nextRefreshAt = Date.now() + CONFIG.refreshEveryMs;
  refreshText.textContent =
    reason === "initial" ? "Loading dashboard…" : "Refreshing latest information…";

  frame.src = dashboardUrl();

  retryTimer = setTimeout(() => {
    refreshText.textContent = "Load is taking longer than expected — retrying…";
    frame.src = dashboardUrl();
  }, CONFIG.retryAfterMs);
}

function updateClockAndRefreshText() {
  const now = new Date();

  clock.textContent = formatTime(now);
  dateLabel.textContent = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: CONFIG.timeZone
  }).format(now);

  if (!lastLoadedAt || document.body.classList.contains("loading")) return;

  const remaining = Math.max(0, nextRefreshAt - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  refreshText.textContent =
    `Updated ${formatTime(lastLoadedAt)} • next refresh ${minutes}:${String(seconds).padStart(2, "0")}`;
}

function setOnlineState() {
  const isOnline = navigator.onLine;

  offlineBadge.hidden = isOnline;
  connectionState.classList.toggle("offline", !isOnline);
  connectionState.querySelector("span:last-child").textContent =
    isOnline ? "LIVE" : "OFFLINE";

  if (isOnline) {
    loadDashboard("connection-restored");
  } else {
    refreshText.textContent = "Offline — showing last loaded information";
  }
}

frame.addEventListener("load", () => {
  clearTimeout(retryTimer);
  lastLoadedAt = new Date();

  setTimeout(() => {
    setLoading(false);
    updateClockAndRefreshText();
  }, 450);
});

window.addEventListener("online", setOnlineState);
window.addEventListener("offline", setOnlineState);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() >= nextRefreshAt) {
    loadDashboard("screen-restored");
  }
});

updateClockAndRefreshText();
setInterval(updateClockAndRefreshText, 1000);

loadDashboard("initial");
setInterval(() => loadDashboard("scheduled"), CONFIG.refreshEveryMs);
