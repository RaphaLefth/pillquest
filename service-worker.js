// =============================================================================
// PILLQUEST SERVICE WORKER
// Cache-first strategy for offline functionality
// =============================================================================

"use strict";

const CACHE_NAME = "pillquest-v1.0.0";
const STATIC_CACHE_NAME = "pillquest-static-v1.0.0";
const DYNAMIC_CACHE_NAME = "pillquest-dynamic-v1.0.0";

// Files to cache for offline functionality
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/main.js",
  "./manifest.webmanifest",
  "./icons/icon-72.svg",
  "./icons/icon-96.svg",
  "./icons/icon-128.svg",
  "./icons/icon-144.svg",
  "./icons/icon-152.svg",
  "./icons/icon-192.svg",
  "./icons/icon-384.svg",
  "./icons/icon-512.svg",
  "./i18n/es.json",
  "./i18n/en.json",
];

// Network-first resources (fallback to cache)
const NETWORK_FIRST_PATHS = ["/api/", "./i18n/"];

// Cache-first resources
const CACHE_FIRST_PATHS = ["./css/", "./js/", "./icons/", "./images/"];

// =============================================================================
// SERVICE WORKER EVENTS
// =============================================================================

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");

  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log("Caching static assets...");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log("Static assets cached successfully");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("Failed to cache static assets:", error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== STATIC_CACHE_NAME &&
              cacheName !== DYNAMIC_CACHE_NAME
            ) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("Service Worker activated");
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content or fetch from network
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  const pathname = requestUrl.pathname;

  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip external requests
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(handleFetchRequest(event.request, pathname));
});

// Push event - handle push notifications
self.addEventListener("push", (event) => {
  console.log("Push notification received:", event);

  const options = {
    body: event.data ? event.data.text() : "Es hora de tomar tu medicación",
    icon: "./icons/icon-192.svg",
    badge: "./icons/icon-96.svg",
    tag: "pill-reminder",
    requireInteraction: true,
    actions: [
      {
        action: "take",
        title: "Tomar Ahora",
        icon: "./icons/icon-96.svg",
      },
      {
        action: "snooze",
        title: "Recordar en 10 min",
        icon: "./icons/icon-96.svg",
      },
    ],
    data: {
      url: "./#home",
    },
  };

  event.waitUntil(
    self.registration.showNotification("PillQuest - Recordatorio", options)
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event);

  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data;

  if (action === "take") {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.postMessage({
              type: "NOTIFICATION_CLICK",
              action: "take",
            });
            return client.focus();
          }
        }

        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(notificationData.url || "./");
        }
      })
    );
  } else if (action === "snooze") {
    // Schedule another notification in 10 minutes
    setTimeout(() => {
      self.registration.showNotification("PillQuest - Recordatorio", {
        body: "No olvides tomar tu medicación",
        icon: "./icons/icon-192.svg",
        tag: "pill-reminder-snooze",
      });
    }, 10 * 60 * 1000); // 10 minutes
  } else {
    // Default action - open app
    event.waitUntil(clients.openWindow(notificationData.url || "./"));
  }
});

// Background sync event
self.addEventListener("sync", (event) => {
  console.log("Background sync triggered:", event.tag);

  if (event.tag === "dose-sync") {
    event.waitUntil(syncPendingDoses());
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function handleFetchRequest(request, pathname) {
  try {
    // Handle different caching strategies based on path
    if (shouldUseNetworkFirst(pathname)) {
      return await networkFirstStrategy(request);
    } else if (shouldUseCacheFirst(pathname)) {
      return await cacheFirstStrategy(request);
    } else {
      return await staleWhileRevalidateStrategy(request);
    }
  } catch (error) {
    console.error("Fetch handler error:", error);
    return await fallbackResponse(request);
  }
}

function shouldUseNetworkFirst(pathname) {
  return NETWORK_FIRST_PATHS.some((path) => pathname.startsWith(path));
}

function shouldUseCacheFirst(pathname) {
  return CACHE_FIRST_PATHS.some((path) => pathname.startsWith(path));
}

async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("Network failed, trying cache:", request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error("Both cache and network failed:", error);
    throw error;
  }
}

async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.warn("Network request failed:", error);
      return cachedResponse;
    });

  return cachedResponse || (await fetchPromise);
}

async function fallbackResponse(request) {
  // Provide offline fallback for HTML requests
  if (request.destination === "document") {
    const cachedIndex = await caches.match("./index.html");
    if (cachedIndex) {
      return cachedIndex;
    }
  }

  // Provide fallback for images
  if (request.destination === "image") {
    const cachedIcon = await caches.match("./icons/icon-192.svg");
    if (cachedIcon) {
      return cachedIcon;
    }
  }

  // Generic offline response
  return new Response(
    JSON.stringify({
      error: "Offline",
      message: "No hay conexión a internet",
    }),
    {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function syncPendingDoses() {
  try {
    console.log("Syncing pending doses...");

    // This would typically sync with a backend API
    // For now, we'll just log that sync was attempted

    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "SYNC_COMPLETE",
        success: true,
      });
    });
  } catch (error) {
    console.error("Dose sync failed:", error);
  }
}

// =============================================================================
// CACHE MANAGEMENT UTILITIES
// =============================================================================

// Clean up old caches periodically
function cleanupOldCaches() {
  caches.keys().then((cacheNames) => {
    cacheNames.forEach((cacheName) => {
      if (
        cacheName.includes("pillquest") &&
        cacheName !== STATIC_CACHE_NAME &&
        cacheName !== DYNAMIC_CACHE_NAME
      ) {
        console.log("Cleaning up old cache:", cacheName);
        caches.delete(cacheName);
      }
    });
  });
}

// Preload critical resources
function preloadCriticalResources() {
  const criticalResources = ["./css/styles.css", "./js/main.js"];

  caches.open(STATIC_CACHE_NAME).then((cache) => {
    cache.addAll(criticalResources);
  });
}

// Message handling
self.addEventListener("message", (event) => {
  console.log("Service Worker received message:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({
      version: CACHE_NAME,
    });
  }
});

console.log("PillQuest Service Worker loaded successfully");
