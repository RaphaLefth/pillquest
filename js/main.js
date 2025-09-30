// =============================================================================
// PILLQUEST PWA - MAIN APPLICATION
// Vanilla JavaScript - No modules, no external dependencies
// =============================================================================

"use strict";

// =============================================================================
// GLOBAL VARIABLES AND CONSTANTS
// =============================================================================
let db = null;
let currentUser = null;
let i18n = {};
let currentLanguage = "es";

const APP_CONFIG = {
  DB_NAME: "PillQuestDB",
  DB_VERSION: 2, // Increased to force database upgrade
  DOSE_WINDOW_MINUTES: 60, // ±60 minutes window for taking doses
  POINTS_PER_DOSE: 10,
  COINS_PER_DOSE: 5,
};

const ACHIEVEMENTS = [
  {
    id: "first_dose",
    name: "Primera Dosis",
    description: "Toma tu primera dosis",
    icon: "🎯",
    unlocked: false,
  },
  {
    id: "week_perfect",
    name: "Semana Perfecta",
    description: "7 días consecutivos tomando medicación",
    icon: "⭐",
    unlocked: false,
  },
  {
    id: "month_master",
    name: "Maestro del Mes",
    description: "30 días consecutivos",
    icon: "👑",
    unlocked: false,
  },
  {
    id: "early_bird",
    name: "Madrugador",
    description: "Toma medicación antes de las 8 AM",
    icon: "🌅",
    unlocked: false,
  },
  {
    id: "consistent",
    name: "Constante",
    description: "Toma medicación 5 días seguidos",
    icon: "💪",
    unlocked: false,
  },
  {
    id: "hundred_doses",
    name: "Centurión",
    description: "Toma 100 dosis",
    icon: "🏆",
    unlocked: false,
  },
  {
    id: "never_miss",
    name: "Inquebrantable",
    description: "14 días sin fallar",
    icon: "🔥",
    unlocked: false,
  },
  {
    id: "point_collector",
    name: "Coleccionista",
    description: "Alcanza 500 puntos",
    icon: "💎",
    unlocked: false,
  },
];

// =============================================================================
// INDEXEDDB WRAPPER AND DATABASE INITIALIZATION
// =============================================================================
class DatabaseManager {
  static async init() {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db);
        return;
      }

      const request = indexedDB.open(APP_CONFIG.DB_NAME, APP_CONFIG.DB_VERSION);

      request.onerror = () => {
        console.error("Database error:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        db = request.result;
        console.log("Database opened successfully");
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;
        console.log(`Database upgrade: v${oldVersion} -> v${newVersion}`);

        // Clear existing stores if upgrading
        const storeNames = Array.from(database.objectStoreNames);
        storeNames.forEach((storeName) => {
          console.log(`Deleting existing store: ${storeName}`);
          database.deleteObjectStore(storeName);
        });

        // Users store
        console.log("Creating users store...");
        const userStore = database.createObjectStore("users", {
          keyPath: "id",
          autoIncrement: true,
        });
        userStore.createIndex("username", "username", { unique: true });
        console.log("Users store created with username index");

        // Treatments store
        console.log("Creating treatments store...");
        const treatmentStore = database.createObjectStore("treatments", {
          keyPath: "id",
          autoIncrement: true,
        });
        treatmentStore.createIndex("userId", "userId", { unique: false });
        console.log("Treatments store created");

        // Doses store
        console.log("Creating doses store...");
        const doseStore = database.createObjectStore("doses", {
          keyPath: "id",
          autoIncrement: true,
        });
        doseStore.createIndex("treatmentId", "treatmentId", {
          unique: false,
        });
        doseStore.createIndex("scheduledAt", "scheduledAt", {
          unique: false,
        });
        doseStore.createIndex("status", "status", { unique: false });
        doseStore.createIndex("composite", ["treatmentId", "scheduledAt"], {
          unique: true,
        });
        console.log("Doses store created with all indexes");

        // User Stats store
        console.log("Creating user_stats store...");
        const statsStore = database.createObjectStore("user_stats", {
          keyPath: "userId",
        });
        console.log("User stats store created");

        // Achievements store
        console.log("Creating achievements store...");
        const achievementStore = database.createObjectStore("achievements", {
          keyPath: "id",
          autoIncrement: true,
        });
        achievementStore.createIndex("userId", "userId", { unique: false });
        console.log("Achievements store created");

        console.log("All database stores created successfully!");
      };
    });
  }

  static validateDatabase() {
    if (!db) {
      throw new Error("Database not initialized");
    }

    const requiredStores = [
      "users",
      "treatments",
      "doses",
      "user_stats",
      "achievements",
    ];
    const existingStores = Array.from(db.objectStoreNames);
    const missingStores = requiredStores.filter(
      (storeName) => !existingStores.includes(storeName)
    );

    if (missingStores.length > 0) {
      console.error("Missing stores:", missingStores);
      console.log("Existing stores:", existingStores);
      throw new Error(
        `Database missing required stores: ${missingStores.join(", ")}`
      );
    }

    console.log(
      "Database validation passed. All stores present:",
      existingStores
    );
    return true;
  }

  static async executeTransaction(storeName, mode, callback) {
    try {
      // Validate database before each transaction
      this.validateDatabase();

      if (!db.objectStoreNames.contains(storeName)) {
        throw new Error(`Store '${storeName}' not found in database`);
      }

      const transaction = db.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);
      return await callback(store, transaction);
    } catch (error) {
      console.error("Transaction error:", error);
      throw error;
    }
  }

  static async getAll(storeName) {
    return this.executeTransaction(storeName, "readonly", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  static async getByIndex(storeName, indexName, value) {
    return this.executeTransaction(storeName, "readonly", (store) => {
      return new Promise((resolve, reject) => {
        try {
          if (!store.indexNames.contains(indexName)) {
            console.warn(`Index ${indexName} not found in store ${storeName}`);
            resolve([]);
            return;
          }
          const index = store.index(indexName);
          const request = index.getAll(value);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        } catch (error) {
          console.error(`Error accessing index ${indexName}:`, error);
          resolve([]);
        }
      });
    });
  }

  static async add(storeName, data) {
    return this.executeTransaction(storeName, "readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  static async put(storeName, data) {
    return this.executeTransaction(storeName, "readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  static async get(storeName, key) {
    return this.executeTransaction(storeName, "readonly", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  static async delete(storeName, key) {
    return this.executeTransaction(storeName, "readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }
}

// =============================================================================
// REPOSITORY PATTERN FOR DATA ACCESS
// =============================================================================
class UserRepository {
  static async create(userData) {
    const user = {
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const id = await DatabaseManager.add("users", user);
    return { ...user, id };
  }

  static async getByUsername(username) {
    try {
      const users = await DatabaseManager.getByIndex(
        "users",
        "username",
        username
      );
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error("Error getting user by username:", error);

      // Fallback: get all users and filter manually
      try {
        const allUsers = await DatabaseManager.getAll("users");
        const user = allUsers.find((u) => u.username === username);
        return user || null;
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        return null;
      }
    }
  }

  static async getById(id) {
    return await DatabaseManager.get("users", id);
  }

  static async update(id, updates) {
    const user = await this.getById(id);
    if (!user) throw new Error("User not found");

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await DatabaseManager.put("users", updatedUser);
    return updatedUser;
  }
}

class TreatmentRepository {
  static async create(treatmentData) {
    const treatment = {
      ...treatmentData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: true,
    };
    const id = await DatabaseManager.add("treatments", treatment);
    return { ...treatment, id };
  }

  static async getByUserId(userId) {
    return await DatabaseManager.getByIndex("treatments", "userId", userId);
  }

  static async getById(id) {
    return await DatabaseManager.get("treatments", id);
  }

  static async update(id, updates) {
    const treatment = await this.getById(id);
    if (!treatment) throw new Error("Treatment not found");

    const updatedTreatment = {
      ...treatment,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await DatabaseManager.put("treatments", updatedTreatment);
    return updatedTreatment;
  }
}

class DoseRepository {
  static async create(doseData) {
    const dose = {
      ...doseData,
      createdAt: new Date().toISOString(),
      status: "scheduled",
    };

    try {
      const id = await DatabaseManager.add("doses", dose);
      return { ...dose, id };
    } catch (error) {
      if (error.name === "ConstraintError") {
        throw new Error("Duplicate dose for this time slot");
      }
      throw error;
    }
  }

  static async getByTreatmentId(treatmentId) {
    return await DatabaseManager.getByIndex(
      "doses",
      "treatmentId",
      treatmentId
    );
  }

  static async markAsTaken(id, takenAt = null) {
    const dose = await DatabaseManager.get("doses", id);
    if (!dose) throw new Error("Dose not found");

    const updatedDose = {
      ...dose,
      status: "taken",
      takenAt: takenAt || new Date().toISOString(),
    };
    await DatabaseManager.put("doses", updatedDose);
    return updatedDose;
  }

  static async getPendingDosesForUser(userId) {
    const treatments = await TreatmentRepository.getByUserId(userId);
    const pendingDoses = [];

    for (const treatment of treatments) {
      if (!treatment.active) continue;

      const doses = await this.getByTreatmentId(treatment.id);
      const pending = doses.filter((dose) => {
        if (dose.status !== "scheduled") return false;

        const scheduledTime = new Date(dose.scheduledAt);
        const now = new Date();
        const windowStart = new Date(
          scheduledTime.getTime() - APP_CONFIG.DOSE_WINDOW_MINUTES * 60 * 1000
        );
        const windowEnd = new Date(
          scheduledTime.getTime() + APP_CONFIG.DOSE_WINDOW_MINUTES * 60 * 1000
        );

        return now >= windowStart && now <= windowEnd;
      });

      pendingDoses.push(...pending.map((dose) => ({ ...dose, treatment })));
    }

    return pendingDoses;
  }

  static async getTodaysTakenDoses(userId) {
    const treatments = await TreatmentRepository.getByUserId(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const takenDoses = [];
    for (const treatment of treatments) {
      const doses = await this.getByTreatmentId(treatment.id);
      const todayTaken = doses.filter((dose) => {
        if (dose.status !== "taken" || !dose.takenAt) return false;
        const takenDate = new Date(dose.takenAt);
        return takenDate >= today && takenDate < tomorrow;
      });
      takenDoses.push(...todayTaken);
    }

    return takenDoses;
  }
}

class UserStatsRepository {
  static async getOrCreate(userId) {
    let stats = await DatabaseManager.get("user_stats", userId);
    if (!stats) {
      stats = {
        userId,
        totalPoints: 0,
        totalCoins: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalDoses: 0,
        lastDoseDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await DatabaseManager.put("user_stats", stats);
    }
    return stats;
  }

  static async update(userId, updates) {
    const stats = await this.getOrCreate(userId);
    const updatedStats = {
      ...stats,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await DatabaseManager.put("user_stats", updatedStats);
    return updatedStats;
  }

  static async addPoints(userId, points) {
    const stats = await this.getOrCreate(userId);
    return this.update(userId, {
      totalPoints: stats.totalPoints + points,
      totalCoins: stats.totalCoins + APP_CONFIG.COINS_PER_DOSE,
    });
  }

  static async updateStreak(userId) {
    const stats = await this.getOrCreate(userId);
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (!stats.lastDoseDate) {
      // First dose ever
      return this.update(userId, {
        currentStreak: 1,
        longestStreak: Math.max(1, stats.longestStreak),
        lastDoseDate: today,
        totalDoses: stats.totalDoses + 1,
      });
    }

    if (stats.lastDoseDate === today) {
      // Already took dose today, just increment total
      return this.update(userId, {
        totalDoses: stats.totalDoses + 1,
      });
    }

    if (stats.lastDoseDate === yesterdayStr) {
      // Consecutive day
      const newStreak = stats.currentStreak + 1;
      return this.update(userId, {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, stats.longestStreak),
        lastDoseDate: today,
        totalDoses: stats.totalDoses + 1,
      });
    }

    // Streak broken
    return this.update(userId, {
      currentStreak: 1,
      lastDoseDate: today,
      totalDoses: stats.totalDoses + 1,
    });
  }
}

class AchievementRepository {
  static async getUserAchievements(userId) {
    return await DatabaseManager.getByIndex("achievements", "userId", userId);
  }

  static async unlockAchievement(userId, achievementId) {
    const existing = await this.getUserAchievements(userId);
    const hasAchievement = existing.some(
      (a) => a.achievementId === achievementId
    );

    if (!hasAchievement) {
      const achievement = {
        userId,
        achievementId,
        unlockedAt: new Date().toISOString(),
      };
      await DatabaseManager.add("achievements", achievement);
      return achievement;
    }
    return null;
  }

  static async checkAndUnlockAchievements(userId) {
    const stats = await UserStatsRepository.getOrCreate(userId);
    const userAchievements = await this.getUserAchievements(userId);
    const unlockedIds = userAchievements.map((a) => a.achievementId);
    const newAchievements = [];

    // Check each achievement condition
    if (!unlockedIds.includes("first_dose") && stats.totalDoses >= 1) {
      const achievement = await this.unlockAchievement(userId, "first_dose");
      if (achievement) newAchievements.push(achievement);
    }

    if (!unlockedIds.includes("week_perfect") && stats.currentStreak >= 7) {
      const achievement = await this.unlockAchievement(userId, "week_perfect");
      if (achievement) newAchievements.push(achievement);
    }

    if (!unlockedIds.includes("month_master") && stats.currentStreak >= 30) {
      const achievement = await this.unlockAchievement(userId, "month_master");
      if (achievement) newAchievements.push(achievement);
    }

    if (!unlockedIds.includes("consistent") && stats.currentStreak >= 5) {
      const achievement = await this.unlockAchievement(userId, "consistent");
      if (achievement) newAchievements.push(achievement);
    }

    if (!unlockedIds.includes("hundred_doses") && stats.totalDoses >= 100) {
      const achievement = await this.unlockAchievement(userId, "hundred_doses");
      if (achievement) newAchievements.push(achievement);
    }

    if (!unlockedIds.includes("never_miss") && stats.currentStreak >= 14) {
      const achievement = await this.unlockAchievement(userId, "never_miss");
      if (achievement) newAchievements.push(achievement);
    }

    if (!unlockedIds.includes("point_collector") && stats.totalPoints >= 500) {
      const achievement = await this.unlockAchievement(
        userId,
        "point_collector"
      );
      if (achievement) newAchievements.push(achievement);
    }

    // Check early bird (took dose before 8 AM today)
    if (!unlockedIds.includes("early_bird")) {
      const todayDoses = await DoseRepository.getTodaysTakenDoses(userId);
      const earlyDose = todayDoses.some((dose) => {
        const takenTime = new Date(dose.takenAt);
        return takenTime.getHours() < 8;
      });
      if (earlyDose) {
        const achievement = await this.unlockAchievement(userId, "early_bird");
        if (achievement) newAchievements.push(achievement);
      }
    }

    return newAchievements;
  }
}

// =============================================================================
// UTILITIES AND HELPERS
// =============================================================================
class Utils {
  static formatTime(date) {
    return new Intl.DateTimeFormat("es", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  static formatDate(date) {
    return new Intl.DateTimeFormat("es", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  }

  static showToast(message, type = "success", duration = 3000) {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const title =
      type === "success"
        ? "✅ Éxito"
        : type === "error"
        ? "❌ Error"
        : type === "warning"
        ? "⚠️ Atención"
        : "ℹ️ Información";

    toast.innerHTML = `
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      toast.style.animation = "slideInToast 0.3s ease reverse";
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  static showError(message, error = null) {
    console.error("Application Error:", message, error);
    this.showToast(message, "error");

    // Show error overlay for critical errors
    if (error && error.critical) {
      const overlay = document.getElementById("error-overlay");
      const messageEl = document.getElementById("error-message");
      messageEl.textContent = message;
      overlay.classList.remove("hidden");
    }
  }

  static generateDosesForTreatment(treatment, startDate, days = 30) {
    const doses = [];
    const start = new Date(startDate);

    for (let day = 0; day < days; day++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + day);

      treatment.schedule.forEach((time) => {
        const [hours, minutes] = time.split(":").map(Number);
        const scheduledAt = new Date(currentDate);
        scheduledAt.setHours(hours, minutes, 0, 0);

        doses.push({
          treatmentId: treatment.id,
          scheduledAt: scheduledAt.toISOString(),
          medicationName: treatment.medicationName,
          dosage: treatment.dosage,
        });
      });
    }

    return doses;
  }

  static async requestNotificationPermission() {
    if ("Notification" in window && "serviceWorker" in navigator) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        this.showToast("Notificaciones activadas correctamente", "success");
        return true;
      } else {
        this.showToast("Las notificaciones no están activadas", "warning");
        return false;
      }
    }
    return false;
  }

  static scheduleNotification(title, body, scheduledAt) {
    if ("serviceWorker" in navigator && Notification.permission === "granted") {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body: body,
          icon: "./icons/icon-192.svg",
          badge: "./icons/icon-96.svg",
          tag: "pill-reminder",
          requireInteraction: true,
          timestamp: scheduledAt ? new Date(scheduledAt).getTime() : Date.now(),
          data: {
            scheduledAt,
          },
          actions: [
            { action: "take", title: "Tomar Ahora" },
            { action: "snooze", title: "Recordar en 10 min" },
          ],
        });
      });
    }
  }
}

// =============================================================================
// ROUTING SYSTEM
// =============================================================================
class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.init();
  }

  init() {
    window.addEventListener("hashchange", () => this.handleRoute());
    this.handleRoute();
  }

  register(path, handler) {
    this.routes[path] = handler;
  }

  navigate(path) {
    window.location.hash = path;
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || "home";
    const [route, ...params] = hash.split("/");

    if (this.routes[route]) {
      this.currentRoute = route;
      this.routes[route](params);
      this.updateNavigation();
    } else {
      this.navigate("home");
    }
  }

  updateNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const bottomNav = document.getElementById("bottom-nav");

    navItems.forEach((item) => {
      const screen = item.getAttribute("data-screen");
      item.classList.toggle("active", screen === this.currentRoute);
    });

    // Hide navigation on register screen
    if (this.currentRoute === "register") {
      bottomNav.classList.add("hidden");
    } else {
      bottomNav.classList.remove("hidden");
    }
  }
}

// =============================================================================
// SCREEN COMPONENTS
// =============================================================================
class ScreenManager {
  constructor() {
    this.container = document.getElementById("screen-container");
  }

  render(content) {
    this.container.innerHTML = content;
    this.container.classList.remove("hidden");

    // Hide loading screen
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.classList.add("hidden");
    }
  }

  renderRegisterScreen() {
    return `
            <div class="screen register-screen">
                <div class="register-header">
                    <div class="pill-avatar">💊</div>
                    <h1 class="register-title">Bienvenido a PillQuest</h1>
                    <p class="register-subtitle">Gamifica tu adherencia a medicamentos</p>
                </div>
                
                <form id="register-form" class="card">
                    <div class="form-group">
                        <label class="form-label" for="name">Nombre completo</label>
                        <input type="text" id="name" class="form-input" required placeholder="Ej: Juan Pérez">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="username">Nombre de usuario</label>
                        <input type="text" id="username" class="form-input" required placeholder="Ej: juanperez">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="timezone">Zona horaria</label>
                        <select id="timezone" class="form-select" required>
                            <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
                            <option value="America/Bogota">Bogotá (UTC-5)</option>
                            <option value="America/Lima">Lima (UTC-5)</option>
                            <option value="America/Argentina/Buenos_Aires">Buenos Aires (UTC-3)</option>
                            <option value="Europe/Madrid">Madrid (UTC+1)</option>
                        </select>
                    </div>
                    
                    <h3 style="margin: 24px 0 16px 0; color: var(--text-primary);">Tratamiento inicial</h3>
                    
                    <div class="form-group">
                        <label class="form-label" for="medication">Medicamento</label>
                        <input type="text" id="medication" class="form-input" required placeholder="Ej: Ibuprofeno">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="dosage">Dosis</label>
                        <input type="text" id="dosage" class="form-input" required placeholder="Ej: 400mg">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="frequency">Frecuencia diaria</label>
                        <select id="frequency" class="form-select" required>
                            <option value="1">1 vez al día</option>
                            <option value="2">2 veces al día</option>
                            <option value="3">3 veces al día</option>
                            <option value="4">4 veces al día</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="first-dose">Primera dosis</label>
                        <input type="time" id="first-dose" class="form-input" required value="08:00">
                    </div>
                    
                    <button type="submit" class="btn btn-primary btn-large" style="width: 100%; margin-top: 16px;">
                        Comenzar mi aventura 🚀
                    </button>
                </form>
            </div>
        `;
  }

  renderHomeScreen(user, stats, treatments, pendingDoses) {
    const greeting = this.getGreeting();

    return `
            <div class="screen">
                <div class="home-header">
                    <div class="pill-avatar">💊</div>
                    <h2 class="user-greeting">${greeting}, ${user.name}!</h2>
                    <div class="streak-display">
                        🔥 ${stats.currentStreak} día${
      stats.currentStreak !== 1 ? "s" : ""
    } seguido${stats.currentStreak !== 1 ? "s" : ""}
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">${stats.totalPoints}</span>
                        <div class="stat-label">🏆 Puntos XP</div>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.totalCoins}</span>
                        <div class="stat-label">🪙 Monedas</div>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.totalDoses}</span>
                        <div class="stat-label">💊 Dosis tomadas</div>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.longestStreak}</span>
                        <div class="stat-label">📈 Mejor racha</div>
                    </div>
                </div>

                ${
                  pendingDoses.length > 0
                    ? `
                    <div class="take-now-section">
                        <h3 style="margin-bottom: 16px; text-align: center; color: var(--text-primary);">
                            ¡Es hora de tomar tu medicación!
                        </h3>
                        <button id="take-now-btn" class="take-now-btn" data-dose-id="${pendingDoses[0].id}">
                            💊<br>Tomar Ahora
                        </button>
                        <p style="margin-top: 12px; text-align: center; color: var(--text-secondary);">
                            ${pendingDoses[0].medicationName} - ${pendingDoses[0].dosage}
                        </p>
                    </div>
                `
                    : `
                    <div class="take-now-section">
                        <h3 style="margin-bottom: 16px; text-align: center; color: var(--text-primary);">
                            ¡Genial! No hay dosis pendientes
                        </h3>
                        <div class="take-now-btn" style="background: #ccc; cursor: default;">
                            ✅<br>Al día
                        </div>
                    </div>
                `
                }

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Mis Tratamientos</h3>
                        <button id="add-treatment-btn" class="btn btn-outline">+ Añadir</button>
                    </div>
                    <div class="treatment-list">
                        ${treatments
                          .map(
                            (treatment) => `
                            <div class="treatment-item">
                                <div class="treatment-info">
                                    <h4>${treatment.medicationName}</h4>
                                    <p>${treatment.dosage} • ${
                              treatment.schedule.length
                            } ${
                              treatment.schedule.length === 1 ? "vez" : "veces"
                            } al día</p>
                                    <small style="color: var(--text-secondary);">
                                        Horarios: ${
                                          Array.isArray(treatment.schedule) &&
                                          treatment.schedule.length > 0
                                            ? treatment.schedule.join(", ")
                                            : "Sin horario"
                                        } • Duración: ${
                              treatment.duration || 30
                            } días
                                    </small>
                                </div>
                                <div class="treatment-actions">
                                    <button class="btn btn-outline" onclick="editTreatment(${
                                      treatment.id
                                    })">✏️</button>
                                </div>
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                </div>

        <div id="add-treatment-modal" class="modal hidden">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="modal-title">Añadir tratamiento</h3>
              <button type="button" id="close-add-treatment" class="modal-close" aria-label="Cerrar">
                &times;
              </button>
            </div>
            <form id="add-treatment-form" class="modal-body">
              <div class="form-group">
                <label class="form-label" for="treatment-medication">Medicamento</label>
                <input id="treatment-medication" name="medication" type="text" class="form-input" placeholder="Nombre del medicamento" required autocomplete="off">
              </div>
              <div class="form-group">
                <label class="form-label" for="treatment-dosage">Dosis</label>
                <input id="treatment-dosage" name="dosage" type="text" class="form-input" placeholder="Ej. 1 comprimido" required autocomplete="off">
              </div>
              <div class="form-group">
                <label class="form-label" for="treatment-frequency">Veces al día</label>
                <select id="treatment-frequency" name="frequency" class="form-select" required>
                  <option value="1">1 vez</option>
                  <option value="2">2 veces</option>
                  <option value="3">3 veces</option>
                  <option value="4">4 veces</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="treatment-first-dose">Primera toma</label>
                <input id="treatment-first-dose" name="firstDose" type="time" class="form-input" required>
              </div>
              <div id="treatment-schedule-container"></div>
              <div class="form-group">
                <label class="form-label" for="treatment-start-date">Fecha de inicio</label>
                <input id="treatment-start-date" name="startDate" type="date" class="form-input" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="treatment-duration">Duración (días)</label>
                <input id="treatment-duration" name="duration" type="number" class="form-input" min="1" max="365" value="30" required>
              </div>
              <div class="modal-actions">
                <button type="button" id="cancel-add-treatment" class="btn btn-outline">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
            </div>
        `;
  }

  renderPlaceholderScreen(title, icon, message) {
    return `
            <div class="screen placeholder-screen">
                <div class="placeholder-icon">${icon}</div>
                <h2 class="placeholder-title">${title}</h2>
                <p class="placeholder-message">${message}</p>
                <button onclick="router.navigate('home')" class="btn btn-primary">
                    Volver al Inicio
                </button>
            </div>
        `;
  }

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  }
}

// =============================================================================
// APPLICATION CONTROLLER
// =============================================================================
class PillQuestApp {
  constructor() {
    this.router = new Router();
    this.screenManager = new ScreenManager();
    this.notificationTimers = [];
    this.init();
  }

  async initializeDatabase() {
    try {
      await DatabaseManager.init();

      // Verify all required stores exist
      const requiredStores = [
        "users",
        "treatments",
        "doses",
        "user_stats",
        "achievements",
      ];
      const missingStores = requiredStores.filter(
        (storeName) => !db.objectStoreNames.contains(storeName)
      );

      if (missingStores.length > 0) {
        console.warn(
          `Missing stores detected: ${missingStores.join(
            ", "
          )}. Forcing database recreation...`
        );
        throw new Error(`Missing stores: ${missingStores.join(", ")}`);
      }

      console.log("Database initialized successfully with all stores");
    } catch (error) {
      console.error(
        "Database initialization failed, attempting recovery...",
        error
      );

      // Try to delete and recreate database
      try {
        console.log("Deleting existing database...");
        indexedDB.deleteDatabase(APP_CONFIG.DB_NAME);

        // Wait for deletion to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Reset db variable
        db = null;

        console.log("Recreating database...");
        await DatabaseManager.init();

        // Verify again
        const requiredStores = [
          "users",
          "treatments",
          "doses",
          "user_stats",
          "achievements",
        ];
        const stillMissing = requiredStores.filter(
          (storeName) => !db.objectStoreNames.contains(storeName)
        );

        if (stillMissing.length > 0) {
          throw new Error(
            `Still missing stores after recreation: ${stillMissing.join(", ")}`
          );
        }

        console.log("Database recreated successfully with all stores");
      } catch (retryError) {
        console.error("Database recovery failed:", retryError);
        throw retryError;
      }
    }
  }

  async init() {
    try {
      // Initialize database with retry mechanism
      await this.initializeDatabase();

      // Load internationalization
      await this.loadI18n();

      // Setup global error handlers
      this.setupErrorHandlers();

      // Setup service worker
      await this.registerServiceWorker();

      // Setup routes
      this.setupRoutes();

      // Check if user is registered
      await this.checkAuthState();

      console.log("PillQuest App initialized successfully");
    } catch (error) {
      Utils.showError("Error iniciando la aplicación", { critical: true });
      console.error("App initialization error:", error);
    }
  }

  setupRoutes() {
    this.router.register("register", () => this.showRegisterScreen());
    this.router.register("home", () => this.showHomeScreen());
    this.router.register("rewards", () => this.showRewardsScreen());
    this.router.register("shop", () => this.showShopScreen());
    this.router.register("table", () => this.showTableScreen());
    this.router.register("settings", () => this.showSettingsScreen());
  }

  setupErrorHandlers() {
    window.addEventListener("error", (event) => {
      Utils.showError("Error inesperado en la aplicación");
      console.error("Global error:", event.error);
    });

    window.addEventListener("unhandledrejection", (event) => {
      Utils.showError("Error de conexión o datos");
      console.error("Unhandled promise rejection:", event.reason);
    });

    // Retry button handler
    document.getElementById("error-retry").addEventListener("click", () => {
      document.getElementById("error-overlay").classList.add("hidden");
      window.location.reload();
    });
  }

  async registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(
          "./service-worker.js"
        );
        console.log(
          "Service Worker registered successfully:",
          registration.scope
        );
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    }
  }

  async loadI18n() {
    try {
      const response = await fetch(`./i18n/${currentLanguage}.json`);
      if (response.ok) {
        i18n = await response.json();
      } else {
        // Fallback to default translations
        i18n = {
          app_name: "PillQuest",
          welcome: "Bienvenido",
          loading: "Cargando...",
        };
      }
    } catch (error) {
      console.warn("Could not load i18n files:", error);
      i18n = {};
    }
  }

  async checkAuthState() {
    const users = await DatabaseManager.getAll("users");
    if (users.length > 0) {
      currentUser = users[0]; // For now, support single user
      this.router.navigate("home");
    } else {
      this.router.navigate("register");
    }
  }

  async showRegisterScreen() {
    this.screenManager.render(this.screenManager.renderRegisterScreen());
    this.setupRegisterForm();
  }

  setupRegisterForm() {
    const form = document.getElementById("register-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const formData = new FormData(form);
        const userData = {
          name: document.getElementById("name").value,
          username: document.getElementById("username").value,
          timezone: document.getElementById("timezone").value,
        };

        // Check if username exists
        const existingUser = await UserRepository.getByUsername(
          userData.username
        );
        if (existingUser) {
          Utils.showError("El nombre de usuario ya existe");
          return;
        }

        // Create user
        currentUser = await UserRepository.create(userData);

        // Create initial treatment
        const treatmentData = {
          userId: currentUser.id,
          medicationName: document.getElementById("medication").value,
          dosage: document.getElementById("dosage").value,
          frequency: parseInt(document.getElementById("frequency").value),
          schedule: this.generateSchedule(
            document.getElementById("first-dose").value,
            parseInt(document.getElementById("frequency").value)
          ),
          duration: 30, // Default 30 days
          startDate: new Date().toISOString(),
        };

        const treatment = await TreatmentRepository.create(treatmentData);

        // Generate doses for the treatment
        const doses = Utils.generateDosesForTreatment(treatment, new Date());
        for (const dose of doses) {
          try {
            await DoseRepository.create(dose);
          } catch (error) {
            console.warn("Duplicate dose skipped:", error.message);
          }
        }

        // Initialize user stats
        await UserStatsRepository.getOrCreate(currentUser.id);

        // Request notification permission
        await Utils.requestNotificationPermission();

        Utils.showToast(
          "¡Bienvenido a PillQuest! Tu aventura comienza ahora 🎉"
        );
        this.router.navigate("home");
      } catch (error) {
        Utils.showError("Error al crear cuenta: " + error.message);
      }
    });
  }

  generateSchedule(firstDose, frequency) {
    const schedule = [firstDose];
    if (frequency === 1) return schedule;

    const [hours, minutes] = firstDose.split(":").map(Number);
    const intervalHours = Math.floor(24 / frequency);

    for (let i = 1; i < frequency; i++) {
      const newHour = (hours + intervalHours * i) % 24;
      const timeStr = `${String(newHour).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}`;
      schedule.push(timeStr);
    }

    return schedule;
  }

  async showHomeScreen() {
    if (!currentUser) {
      this.router.navigate("register");
      return;
    }

    try {
      const stats = await UserStatsRepository.getOrCreate(currentUser.id);
      const treatments = await TreatmentRepository.getByUserId(currentUser.id);
      const pendingDoses = await DoseRepository.getPendingDosesForUser(
        currentUser.id
      );

      this.screenManager.render(
        this.screenManager.renderHomeScreen(
          currentUser,
          stats,
          treatments,
          pendingDoses
        )
      );

      this.setupHomeScreenHandlers(pendingDoses);
      await this.scheduleNotificationsForUser(currentUser.id);
    } catch (error) {
      Utils.showError("Error cargando pantalla principal");
      console.error("Home screen error:", error);
    }
  }

  setupHomeScreenHandlers(pendingDoses) {
    // Take Now button
    const takeNowBtn = document.getElementById("take-now-btn");
    if (takeNowBtn && pendingDoses.length > 0) {
      takeNowBtn.addEventListener("click", async () => {
        try {
          const doseId = parseInt(takeNowBtn.getAttribute("data-dose-id"));
          await this.takeDose(doseId);
        } catch (error) {
          Utils.showError("Error al tomar dosis");
        }
      });
    }

    // Add treatment button
    this.setupAddTreatmentModal();
  }

  setupAddTreatmentModal() {
    const modal = document.getElementById("add-treatment-modal");
    const form = document.getElementById("add-treatment-form");
    const addTreatmentBtn = document.getElementById("add-treatment-btn");
    const cancelBtn = document.getElementById("cancel-add-treatment");
    const closeBtn = document.getElementById("close-add-treatment");
    const frequencySelect = document.getElementById("treatment-frequency");
    const firstDoseInput = document.getElementById("treatment-first-dose");
    const scheduleContainer = document.getElementById(
      "treatment-schedule-container"
    );
    const startDateInput = document.getElementById("treatment-start-date");
    const durationInput = document.getElementById("treatment-duration");
    const medicationInput = document.getElementById("treatment-medication");
    const dosageInput = document.getElementById("treatment-dosage");

    if (
      !modal ||
      !form ||
      !addTreatmentBtn ||
      !frequencySelect ||
      !firstDoseInput ||
      !scheduleContainer ||
      !startDateInput ||
      !durationInput ||
      !medicationInput ||
      !dosageInput
    ) {
      return;
    }

    const renderScheduleInputs = () => {
      const frequency = parseInt(frequencySelect.value, 10) || 1;
      const firstDoseValue = firstDoseInput.value || "08:00";
      const autoSchedule = this.generateSchedule(firstDoseValue, frequency);

      scheduleContainer.innerHTML = "";

      for (let i = 0; i < frequency; i++) {
        const wrapper = document.createElement("div");
        wrapper.className = "form-group";

        const label = document.createElement("label");
        label.className = "form-label";
        label.setAttribute("for", `schedule-time-${i}`);
        label.textContent = `Hora ${i + 1}`;

        const input = document.createElement("input");
        input.type = "time";
        input.id = `schedule-time-${i}`;
        input.className = "form-input";
        input.required = true;
        input.value = autoSchedule[i] || autoSchedule[autoSchedule.length - 1];

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        scheduleContainer.appendChild(wrapper);
      }

      const firstInput = scheduleContainer.querySelector("input");
      if (firstInput && firstDoseInput.value) {
        firstInput.value = firstDoseInput.value;
      }
    };

    const closeModal = () => {
      modal.classList.add("hidden");
    };

    const openModal = () => {
      form.reset();
      firstDoseInput.value = this.getDefaultDoseTime();
      startDateInput.value = this.getDefaultStartDate();
      durationInput.value = "30";
      frequencySelect.value = "1";
      renderScheduleInputs();
      modal.classList.remove("hidden");
      medicationInput.focus();
    };

    addTreatmentBtn.addEventListener("click", () => {
      if ("Notification" in window && Notification.permission !== "granted") {
        Utils.requestNotificationPermission();
      }
      openModal();
    });

    if (cancelBtn) {
      cancelBtn.addEventListener("click", (event) => {
        event.preventDefault();
        closeModal();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    frequencySelect.addEventListener("change", renderScheduleInputs);
    firstDoseInput.addEventListener("change", renderScheduleInputs);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!currentUser) {
        Utils.showError("No se ha encontrado el usuario activo");
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const medicationName = medicationInput.value.trim();
        const dosage = dosageInput.value.trim();
        const frequency = parseInt(frequencySelect.value, 10) || 1;
        const duration = parseInt(durationInput.value, 10) || 30;
        const startDateValue = startDateInput.value;

        const scheduleInputs = Array.from(
          scheduleContainer.querySelectorAll('input[type="time"]')
        );
        const scheduleTimes = scheduleInputs
          .map((input) => input.value)
          .filter(Boolean);

        if (scheduleTimes.length !== frequency) {
          throw new Error("Completa los horarios de las tomas");
        }

        const uniqueTimes = Array.from(new Set(scheduleTimes));
        if (uniqueTimes.length !== scheduleTimes.length) {
          throw new Error("No se permiten horarios duplicados");
        }

        uniqueTimes.sort();

        const startDate = startDateValue
          ? new Date(`${startDateValue}T00:00:00`)
          : new Date();
        startDate.setHours(0, 0, 0, 0);

        const treatmentData = {
          userId: currentUser.id,
          medicationName,
          dosage,
          frequency,
          schedule: uniqueTimes,
          duration,
          startDate: startDate.toISOString(),
        };

        const treatment = await TreatmentRepository.create(treatmentData);

        const doses = Utils.generateDosesForTreatment(
          treatment,
          startDate,
          duration
        );

        for (const dose of doses) {
          try {
            await DoseRepository.create(dose);
          } catch (error) {
            const message =
              error instanceof Error && error.message
                ? error.message
                : String(error);
            console.warn("Dose skipped during creation:", message);
          }
        }

        Utils.showToast("Tratamiento añadido correctamente 🎯");
        closeModal();

        await this.scheduleNotificationsForUser(currentUser.id);
        await this.showHomeScreen();
      } catch (error) {
        Utils.showError("No se pudo guardar el tratamiento: " + error.message);
        console.error("Add treatment error:", error);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });

    // Initialize schedule inputs for initial render
    renderScheduleInputs();
  }

  getDefaultDoseTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    now.setSeconds(0, 0);
    const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
    if (roundedMinutes === 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0, 0, 0);
    } else {
      now.setMinutes(roundedMinutes, 0, 0);
    }
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  getDefaultStartDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  clearNotificationTimers() {
    if (this.notificationTimers && this.notificationTimers.length > 0) {
      this.notificationTimers.forEach((timerId) => clearTimeout(timerId));
    }
    this.notificationTimers = [];
  }

  async scheduleNotificationsForUser(userId) {
    if (
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !userId
    ) {
      return;
    }

    this.clearNotificationTimers();

    try {
      const treatments = await TreatmentRepository.getByUserId(userId);
      const now = Date.now();
      const windowLimit = now + 24 * 60 * 60 * 1000; // Next 24 hours

      for (const treatment of treatments) {
        if (!treatment.active) continue;

        const doses = await DoseRepository.getByTreatmentId(treatment.id);
        doses
          .filter((dose) => dose.status === "scheduled")
          .forEach((dose) => {
            const scheduledTime = new Date(dose.scheduledAt).getTime();
            if (Number.isNaN(scheduledTime)) return;
            if (scheduledTime <= now || scheduledTime > windowLimit) return;

            const delay = scheduledTime - now;
            const timerId = setTimeout(() => {
              const timeLabel = new Intl.DateTimeFormat("es", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(dose.scheduledAt));

              Utils.scheduleNotification(
                `PillQuest • ${dose.medicationName}`,
                `Toma ${dose.dosage} a las ${timeLabel}`,
                dose.scheduledAt
              );
            }, delay);

            this.notificationTimers.push(timerId);
          });
      }
    } catch (error) {
      console.error("Error scheduling notifications:", error);
    }
  }

  async takeDose(doseId) {
    try {
      // Mark dose as taken
      await DoseRepository.markAsTaken(doseId);

      // Update user stats
      await UserStatsRepository.addPoints(
        currentUser.id,
        APP_CONFIG.POINTS_PER_DOSE
      );
      await UserStatsRepository.updateStreak(currentUser.id);

      // Check for new achievements
      const newAchievements =
        await AchievementRepository.checkAndUnlockAchievements(currentUser.id);

      // Show success message
      Utils.showToast(
        `¡Excelente! +${APP_CONFIG.POINTS_PER_DOSE} XP, +${APP_CONFIG.COINS_PER_DOSE} monedas 🎉`
      );

      // Show achievement notifications
      newAchievements.forEach((achievement) => {
        const achievementData = ACHIEVEMENTS.find(
          (a) => a.id === achievement.achievementId
        );
        if (achievementData) {
          setTimeout(() => {
            Utils.showToast(
              `🏆 ¡Nuevo logro desbloqueado! ${achievementData.name}`,
              "success",
              4000
            );
          }, 1000);
        }
      });

      // Add success animation
      const takeNowBtn = document.getElementById("take-now-btn");
      if (takeNowBtn) {
        takeNowBtn.classList.add("success-flash");
      }

      await this.scheduleNotificationsForUser(currentUser.id);

      // Refresh screen
      setTimeout(() => this.showHomeScreen(), 1500);
    } catch (error) {
      Utils.showError("Error al registrar dosis: " + error.message);
    }
  }

  async showRewardsScreen() {
    if (!currentUser) {
      this.router.navigate("register");
      return;
    }

    try {
      const userAchievements = await AchievementRepository.getUserAchievements(
        currentUser.id
      );
      const unlockedIds = userAchievements.map((a) => a.achievementId);

      let achievementsHtml = ACHIEVEMENTS.map((achievement) => {
        const unlocked = unlockedIds.includes(achievement.id);
        const userAchievement = userAchievements.find(
          (a) => a.achievementId === achievement.id
        );

        return `
                    <div class="card ${
                      unlocked ? "" : "opacity-50"
                    }" style="opacity: ${unlocked ? 1 : 0.5};">
                        <div class="card-header">
                            <div style="font-size: 2rem;">${
                              achievement.icon
                            }</div>
                            <div>
                                <h3 class="card-title">${achievement.name}</h3>
                                <p class="card-content">${
                                  achievement.description
                                }</p>
                                ${
                                  unlocked && userAchievement
                                    ? `
                                    <small style="color: var(--success-color); font-weight: 600;">
                                        ✅ Desbloqueado el ${Utils.formatDate(
                                          userAchievement.unlockedAt
                                        )}
                                    </small>
                                `
                                    : `
                                    <small style="color: var(--text-secondary);">🔒 Bloqueado</small>
                                `
                                }
                            </div>
                        </div>
                    </div>
                `;
      }).join("");

      const content = `
                <div class="screen">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="color: var(--text-primary); margin-bottom: 8px;">🏆 Logros</h1>
                        <p style="color: var(--text-secondary);">
                            ${unlockedIds.length} de ${
        ACHIEVEMENTS.length
      } desbloqueados
                        </p>
                        <div style="background: var(--border-color); height: 8px; border-radius: 4px; margin: 16px 0; overflow: hidden;">
                            <div style="background: var(--primary-color); height: 100%; width: ${
                              (unlockedIds.length / ACHIEVEMENTS.length) * 100
                            }%; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                    ${achievementsHtml}
                </div>
            `;

      this.screenManager.render(content);
    } catch (error) {
      Utils.showError("Error cargando logros");
      console.error("Rewards screen error:", error);
    }
  }

  showShopScreen() {
    const content = this.screenManager.renderPlaceholderScreen(
      "Tienda de Recompensas",
      "🛍️",
      "Próximamente podrás canjear tus monedas por increíbles recompensas"
    );
    this.screenManager.render(content);
  }

  showTableScreen() {
    const content = this.screenManager.renderPlaceholderScreen(
      "Historial de Dosis",
      "📊",
      "Aquí podrás ver el historial completo de todas tus dosis"
    );
    this.screenManager.render(content);
  }

  showSettingsScreen() {
    const content = this.screenManager.renderPlaceholderScreen(
      "Configuración",
      "⚙️",
      "Personaliza tu experiencia en PillQuest"
    );
    this.screenManager.render(content);
  }
}

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================
let router;
let app;

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", () => {
  // Initialize the application
  app = new PillQuestApp();
  router = app.router;

  // Setup navigation event listeners
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const screen = item.getAttribute("data-screen");
      router.navigate(screen);
    });
  });

  console.log("PillQuest PWA loaded successfully");
});

// Global functions for HTML event handlers
function editTreatment(treatmentId) {
  Utils.showToast("Función de editar próximamente disponible", "warning");
}

// Service Worker communication
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "NOTIFICATION_CLICK") {
      // Handle notification click actions
      if (event.data.action === "take") {
        router.navigate("home");
      }
    }
  });
}
