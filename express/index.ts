import express from "express";
import pg from "pg";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.DB_HOST ?? "db.default.svc.cluster.local";
  const port = process.env.DB_PORT ?? "5432";
  const database = process.env.DB_NAME ?? "postgres";
  const user = process.env.DB_USER ?? "postgres";
  const password = process.env.DB_PASSWORD ?? "postgres";
  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

const pool = new pg.Pool({
  connectionString: getDatabaseUrl(),
});

app.get("/users", async (req, res) => {
  const result = await pool.query("SELECT * FROM users");
  res.json(result.rows);
});

app.post("/users", async (req, res) => {
  const result = await pool.query("INSERT INTO users (name) VALUES ($1) RETURNING *", [req.body.name]);
  res.json(result.rows[0]);
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
  )`);
}

initDb();