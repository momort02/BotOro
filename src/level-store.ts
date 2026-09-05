import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type LevelEntry = {
  xp: number;
  level: number;
  lastMessageAt: number;
};

const dataDirectory = process.env.DATA_DIR ?? "data";
const dataFile = path.join(dataDirectory, "levels.sqlite");
const cooldownMs = 60_000;

class LevelStore {
  private readonly database: DatabaseSync;

  constructor() {
    mkdirSync(dataDirectory, { recursive: true });
    this.database = new DatabaseSync(dataFile);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS levels (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 0,
        last_message_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      ) STRICT;
    `);
  }

  async addMessageXp(guildId: string, userId: string): Promise<{ level: number; leveledUp: boolean }> {
    const now = Date.now();
    const select = this.database.prepare(
      "SELECT xp, level, last_message_at AS lastMessageAt FROM levels WHERE guild_id = ? AND user_id = ?"
    );
    const current = select.get(guildId, userId) as LevelEntry | undefined;
    const entry = current ?? { xp: 0, level: 0, lastMessageAt: 0 };

    if (now - entry.lastMessageAt < cooldownMs) {
      return { level: entry.level, leveledUp: false };
    }

    entry.xp += Math.floor(Math.random() * 11) + 15;
    entry.lastMessageAt = now;
    const nextLevel = Math.floor(Math.sqrt(entry.xp / 100));
    const leveledUp = nextLevel > entry.level;
    this.database.prepare(`
      INSERT INTO levels (guild_id, user_id, xp, level, last_message_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (guild_id, user_id) DO UPDATE SET
        xp = excluded.xp,
        level = excluded.level,
        last_message_at = excluded.last_message_at
    `).run(guildId, userId, entry.xp, nextLevel, now);
    return { level: nextLevel, leveledUp };
  }

  async getMember(guildId: string, userId: string): Promise<LevelEntry> {
    const entry = this.database.prepare(
      "SELECT xp, level, last_message_at AS lastMessageAt FROM levels WHERE guild_id = ? AND user_id = ?"
    ).get(guildId, userId) as LevelEntry | undefined;
    return entry ?? { xp: 0, level: 0, lastMessageAt: 0 };
  }

  async getLeaderboard(guildId: string, limit: number): Promise<Array<{ userId: string; entry: LevelEntry }>> {
    const rows = this.database.prepare(
      "SELECT user_id AS userId, xp, level, last_message_at AS lastMessageAt FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT ?"
    ).all(guildId, limit) as Array<{ userId: string } & LevelEntry>;
    return rows.map(({ userId, xp, level, lastMessageAt }) => ({
      userId,
      entry: { xp, level, lastMessageAt }
    }));
  }
}

export const levelStore = new LevelStore();
