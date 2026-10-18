import { serve } from "@hono/node-server";
import { join } from "node:path";
import { createApp } from "./app.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`환경변수 ${name}이(가) 설정되지 않았습니다. npm run set-password로 값을 만든 뒤 설정하세요.`);
    process.exit(1);
  }
  return value;
}

const app = createApp({
  passwordHash: requireEnv("PASSWORD_HASH"),
  sessionSecret: requireEnv("SESSION_SECRET"),
  membersDir: join(process.cwd(), "members"),
});

const port = Number(process.env["PORT"] ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`listening on :${port}`));
