import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env.local" })

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // DDL é do dono do banco; a aplicação usa outros usuários (DATABASE_URL e DATABASE_ADMIN_URL)
  dbCredentials: { url: (process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL)! },
  strict: true,
  verbose: true,
})
