import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Hono, type MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { verifyPassword } from "./password.js";
import { createLoginLimiter } from "./rate-limit.js";

export interface AppOptions {
  passwordHash: string;
  sessionSecret: string;
  membersDir: string;
  now?: () => number;
}

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function clientIp(forwardedFor: string | undefined): string {
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

function safeNext(next: string | undefined): string {
  const isInternalPath =
    next !== undefined && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");
  return isInternalPath ? next : "/members";
}

export function createApp(options: AppOptions) {
  const now = options.now ?? Date.now;
  const limiter = createLoginLimiter(now);
  const app = new Hono();

  app.post("/login", async (c) => {
    const ip = clientIp(c.req.header("x-forwarded-for"));
    if (limiter.isBlocked(ip)) {
      return c.text("시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.", 429);
    }
    const form = await c.req.parseBody();
    const password = typeof form["password"] === "string" ? form["password"] : "";
    if (!verifyPassword(password, options.passwordHash)) {
      limiter.recordFailure(ip);
      return c.text("비밀번호가 올바르지 않습니다.", 401);
    }
    limiter.reset(ip);
    await setSignedCookie(c, SESSION_COOKIE, String(now() + SESSION_MAX_AGE_SECONDS * 1000), options.sessionSecret, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return c.redirect(safeNext(c.req.query("next")), 302);
  });

  app.post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.redirect("/", 302);
  });

  const requireMember: MiddlewareHandler = async (c, next) => {
    const session = await getSignedCookie(c, options.sessionSecret, SESSION_COOKIE);
    const expiresAt = session ? Number(session) : NaN;
    if (!(expiresAt > now())) {
      const original = c.req.path + new URL(c.req.url).search;
      return c.redirect(`/login?next=${encodeURIComponent(original)}`, 302);
    }
    await next();
    c.header("Cache-Control", "private, no-store");
    c.header("X-Robots-Tag", "noindex, nofollow");
  };
  app.use("/members", requireMember);
  app.use("/members/*", requireMember);

  app.get("/members", async (c) => {
    const html = await readFile(join(options.membersDir, "index.html"), "utf8");
    return c.html(html);
  });

  return app;
}
