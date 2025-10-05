// app.js - Bootstrap and router
import { initStorage } from "./core/storage/index.js";
import { initNotifications } from "./logic/notifications.js";
import { initI18n } from "./i18n/i18n.js";

let currentScreen = null;
const screens = {};

function registerScreen(name, module) {
  screens[name] = module;
}

function showScreen(name, data = {}) {
  if (currentScreen) {
    currentScreen.hide();
  }
  const screen = screens[name];
  if (screen) {
    screen.show(data);
    currentScreen = screen;
  }
}

function initRouter() {
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || "home";
  const [screen, params] = hash.split("?");
  showScreen(screen, parseParams(params));
}

function parseParams(params) {
  if (!params) return {};
  return params.split("&").reduce((acc, pair) => {
    const [key, value] = pair.split("=");
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

async function initApp() {
  try {
    await initStorage();
    await initI18n();
    await initNotifications();

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js", {
        scope: "./",
      });
    }

    // Load screens
    await Promise.all([
      import("./ui/screens/register.js"),
      import("./ui/screens/home.js"),
      import("./ui/screens/rewards.js"),
      import("./ui/screens/shop.js"),
      import("./ui/screens/settings.js"),
      import("./ui/screens/leaderboard.js"),
    ]);

    initRouter();

    // Check if user exists
    const user = await window.db.users.get(1);
    if (!user) {
      showScreen("register");
    } else {
      showScreen("home");
    }
  } catch (error) {
    console.error("Error initializing app:", error);
  }
}

window.addEventListener("load", initApp);

// Global functions
window.showScreen = showScreen;
window.registerScreen = registerScreen;
