// Applies pending SQL migrations from ./drizzle. Used by `npm start` and tests.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = postgres(url, { max: 1, ssl: isLocal ? false : "require", onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  console.log("migrations: up to date");
} finally {
  await client.end();
}
