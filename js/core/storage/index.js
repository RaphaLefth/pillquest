// core/storage/index.js - Vanilla IndexedDB repositories
let db;

export async function initStorage() {
  db = await window.DB.openDB();
  await window.DB.initAchievements();
  console.log("Database initialized");
}

// Repositories
export class UsersRepo {
  static async get(id) {
    return await window.DB.get("users", id);
  }

  static async add(user) {
    return await window.DB.add("users", user);
  }

  static async update(id, updates) {
    const user = await this.get(id);
    if (user) {
      Object.assign(user, updates);
      await window.DB.put("users", user);
      return 1;
    }
    return 0;
  }
}

export class TreatmentsRepo {
  static async getAll(userId) {
    return await window.DB.where("treatments", "userId", userId);
  }

  static async add(treatment) {
    return await window.DB.add("treatments", treatment);
  }

  static async update(id, updates) {
    const treatment = await window.DB.get("treatments", id);
    if (treatment) {
      Object.assign(treatment, updates);
      await window.DB.put("treatments", treatment);
      return 1;
    }
    return 0;
  }

  static async delete(id) {
    // Note: Vanilla IndexedDB doesn't have delete by key directly, need to implement
    // For now, we'll mark as inactive
    return await this.update(id, { active: false });
  }
}

export class DosesRepo {
  static async getPending(userId) {
    const treatments = await TreatmentsRepo.getAll(userId);
    const now = new Date();
    const pending = [];
    for (const treatment of treatments) {
      if (!treatment.active) continue;
      for (const time of treatment.times) {
        const scheduledAt = new Date();
        const [hours, minutes] = time.split(":");
        scheduledAt.setHours(hours, minutes, 0, 0);
        if (
          scheduledAt <= now &&
          scheduledAt > new Date(now.getTime() - 24 * 60 * 60 * 1000)
        ) {
          // Check if dose already exists
          const allDoses = await window.DB.getAll("doses");
          const existing = allDoses.find(
            (d) =>
              d.treatmentId === treatment.id &&
              d.scheduledAt === scheduledAt.getTime()
          );
          if (!existing) {
            pending.push({
              treatmentId: treatment.id,
              scheduledAt: scheduledAt.getTime(),
              status: "scheduled",
            });
          }
        }
      }
    }
    return pending;
  }

  static async markTaken(treatmentId, scheduledAt) {
    const allDoses = await window.DB.getAll("doses");
    const dose = allDoses.find(
      (d) => d.treatmentId === treatmentId && d.scheduledAt === scheduledAt
    );
    if (dose) {
      dose.status = "taken";
      dose.takenAt = Date.now();
      await window.DB.put("doses", dose);
    } else {
      await window.DB.add("doses", {
        treatmentId,
        scheduledAt,
        takenAt: Date.now(),
        status: "taken",
      });
    }
  }
}

export class EconomyRepo {
  static async get(userId) {
    let economy = await window.DB.get("economy", userId);
    if (!economy) {
      economy = {
        id: userId,
        userId,
        coins: 0,
        xp: 0,
        streakCount: 0,
        lastTakenDate: null,
      };
      await window.DB.add("economy", economy);
    }
    return economy;
  }

  static async update(userId, updates) {
    const economy = await this.get(userId);
    Object.assign(economy, updates);
    await window.DB.put("economy", economy);
    return 1;
  }
}

export class SettingsRepo {
  static async get(userId) {
    let settings = await window.DB.get("settings", userId);
    if (!settings) {
      settings = {
        id: userId,
        userId,
        notificationsEnabled: true,
        language: "es",
      };
      await window.DB.add("settings", settings);
    }
    return settings;
  }

  static async update(userId, updates) {
    const settings = await this.get(userId);
    Object.assign(settings, updates);
    await window.DB.put("settings", settings);
    return 1;
  }
}
