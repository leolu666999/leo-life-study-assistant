import fs from "node:fs";
import { dbPath, getDb, uploadsDir } from "../../../lib/db";

const db = getDb();
const taskCount = Number(db.prepare("SELECT COUNT(*) AS count FROM tasks").get()?.count ?? -1);
const uploadNames = fs.readdirSync(uploadsDir).filter((name) => name !== ".gitkeep");
process.stdout.write(JSON.stringify({ dbPath, taskCount, uploadNames }));
