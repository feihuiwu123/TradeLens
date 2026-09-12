import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// 连接串一律来自环境变量，避免把凭据写死在仓库里。
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("运行 drizzle-kit 需要设置 DATABASE_URL（可参考 .env.example）");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
