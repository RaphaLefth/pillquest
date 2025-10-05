// indexeddb.js - Vanilla IndexedDB implementation
let db;

const DB_NAME = "PillQuestDB";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("treatments")) {
        db.createObjectStore("treatments", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
      if (!db.objectStoreNames.contains("doses")) {
        db.createObjectStore("doses", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("achievements")) {
        db.createObjectStore("achievements", { keyPath: "code" });
      }
      if (!db.objectStoreNames.contains("userAchievements")) {
        db.createObjectStore("userAchievements", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
      if (!db.objectStoreNames.contains("economy")) {
        db.createObjectStore("economy", { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains("leaderboard")) {
        db.createObjectStore("leaderboard", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
  });
}

function initAchievements() {
  const achievements = [
    {
      code: "first_dose",
      name: "Primera Dosis",
      desc: "Tomaste tu primera pastilla",
      icon: "🏆",
    },
    {
      code: "week_streak",
      name: "Semana Perfecta",
      desc: "7 días seguidos",
      icon: "🔥",
    },
    {
      code: "month_streak",
      name: "Mes Maestro",
      desc: "30 días seguidos",
      icon: "👑",
    },
    {
      code: "no_miss",
      name: "Impecable",
      desc: "Nunca fallaste una dosis",
      icon: "💎",
    },
    {
      code: "morning_warrior",
      name: "Guerrero Matutino",
      desc: "Dosis matutinas puntuales",
      icon: "🌅",
    },
    {
      code: "night_owl",
      name: "Búho Nocturno",
      desc: "Dosis nocturnas puntuales",
      icon: "🦉",
    },
    {
      code: "consistent",
      name: "Consistente",
      desc: "3 tomas seguidas puntuales",
      icon: "🎯",
    },
    {
      code: "collector",
      name: "Coleccionista",
      desc: "Reúne todas las medallas",
      icon: "🏅",
    },
  ];
  return Promise.all(achievements.map((ach) => add("achievements", ach)));
}

function get(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function add(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function where(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

window.DB = { openDB, initAchievements, get, add, put, getAll, where };
