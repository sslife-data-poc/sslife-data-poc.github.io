import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createPasswordConfig } from "../src/password.js";

const PASSWORD = "team-pass-12";
const MEMBERS_DIR = new URL("./fixtures/members", import.meta.url).pathname;

function setup() {
  const { passwordHash, sessionSecret } = createPasswordConfig(PASSWORD);
  return createApp({ passwordHash, sessionSecret, membersDir: MEMBERS_DIR });
}

function loginForm(password: string) {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password }).toString(),
  };
}

describe("로그인", () => {
  it("올바른 비밀번호로 로그인하면 세션 쿠키를 받고 멤버 페이지가 열린다", async () => {
    const app = setup();

    const login = await app.request("/login", loginForm(PASSWORD));
    expect(login.status).toBe(302);
    expect(login.headers.get("location")).toBe("/members");
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;

    const page = await app.request("/members", { headers: { cookie } });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("멤버 전용 픽스처");
  });
});

describe("접근 제어", () => {
  it("로그인 없이 멤버 페이지에 접근하면 원래 경로를 담아 /login으로 보낸다", async () => {
    const app = setup();

    const res = await app.request("/members");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login?next=%2Fmembers");
  });
});

describe("로그인 후 이동", () => {
  async function loginTo(next: string | undefined) {
    const app = setup();
    const url = next === undefined ? "/login" : `/login?next=${encodeURIComponent(next)}`;
    const res = await app.request(url, loginForm(PASSWORD));
    return res.headers.get("location");
  }

  it("내부 경로 next는 그대로 따라간다", async () => {
    expect(await loginTo("/members/focus")).toBe("/members/focus");
  });

  it.each(["https://evil.example/", "//evil.example/", "/\\evil.example", "members"])(
    "외부로 나가는 next(%s)는 무시하고 /members로 보낸다",
    async (next) => {
      expect(await loginTo(next)).toBe("/members");
    },
  );
});

describe("로그아웃", () => {
  it("로그아웃하면 쿠키가 지워지고 멤버 페이지가 다시 막힌다", async () => {
    const app = setup();
    const login = await app.request("/login", loginForm(PASSWORD));
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;

    const logout = await app.request("/logout", { method: "POST", headers: { cookie } });
    expect(logout.status).toBe(302);
    expect(logout.headers.get("location")).toBe("/");
    const cleared = logout.headers.get("set-cookie")!;
    expect(cleared).toMatch(/session=;|Max-Age=0/);
    const clearedCookie = cleared.split(";")[0]!;

    const page = await app.request("/members", { headers: { cookie: clearedCookie } });
    expect(page.status).toBe(302);
  });
});

describe("멤버 페이지 응답 헤더", () => {
  it("캐시와 검색 색인을 막는다", async () => {
    const app = setup();
    const login = await app.request("/login", loginForm(PASSWORD));
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;

    const page = await app.request("/members", { headers: { cookie } });

    expect(page.headers.get("cache-control")).toBe("private, no-store");
    expect(page.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("세션 쿠키 검증", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  async function loginCookie(app: ReturnType<typeof setup>) {
    const login = await app.request("/login", loginForm(PASSWORD));
    return login.headers.get("set-cookie")!.split(";")[0]!;
  }

  it("다른 SESSION_SECRET으로 서명된 쿠키는 거부한다 (비밀번호 교체 시 세션 무효화)", async () => {
    const cookie = await loginCookie(setup());
    const rotated = setup();

    const page = await rotated.request("/members", { headers: { cookie } });

    expect(page.status).toBe(302);
  });

  it("변조된 쿠키는 거부한다", async () => {
    const app = setup();
    const cookie = await loginCookie(app);
    const tampered = cookie.slice(0, -3) + (cookie.endsWith("AAA") ? "BBB" : "AAA");

    const page = await app.request("/members", { headers: { cookie: tampered } });

    expect(page.status).toBe(302);
  });

  it("30일이 지난 쿠키는 클라이언트가 보내더라도 서버가 거부한다", async () => {
    let now = Date.UTC(2026, 0, 1);
    const { passwordHash, sessionSecret } = createPasswordConfig(PASSWORD);
    const app = createApp({ passwordHash, sessionSecret, membersDir: MEMBERS_DIR, now: () => now });
    const cookie = await loginCookie(app);

    now += 29 * DAY_MS;
    expect((await app.request("/members", { headers: { cookie } })).status).toBe(200);

    now += 2 * DAY_MS;
    expect((await app.request("/members", { headers: { cookie } })).status).toBe(302);
  });
});

describe("로그인 시도 제한", () => {
  const MINUTE_MS = 60 * 1000;

  function limitedSetup() {
    const clock = { now: Date.UTC(2026, 0, 1) };
    const { passwordHash, sessionSecret } = createPasswordConfig(PASSWORD);
    const app = createApp({ passwordHash, sessionSecret, membersDir: MEMBERS_DIR, now: () => clock.now });
    const attempt = (password: string, ip: string) =>
      app.request("/login", {
        ...loginForm(password),
        headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": ip },
      });
    return { clock, attempt };
  }

  it("10분 안에 5회 실패하면 올바른 비밀번호도 15분간 거부한다", async () => {
    const { clock, attempt } = limitedSetup();
    for (let i = 0; i < 5; i++) {
      expect((await attempt("wrong-pass", "203.0.113.1")).status).toBe(401);
    }

    const blocked = await attempt(PASSWORD, "203.0.113.1");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("set-cookie")).toBeNull();

    clock.now += 14 * MINUTE_MS;
    expect((await attempt(PASSWORD, "203.0.113.1")).status).toBe(429);

    clock.now += 2 * MINUTE_MS;
    expect((await attempt(PASSWORD, "203.0.113.1")).status).toBe(302);
  });

  it("다른 IP는 영향을 받지 않는다", async () => {
    const { attempt } = limitedSetup();
    for (let i = 0; i < 5; i++) await attempt("wrong-pass", "203.0.113.1");

    expect((await attempt(PASSWORD, "203.0.113.2")).status).toBe(302);
  });

  it("10분이 지나 오래된 실패는 세지 않는다", async () => {
    const { clock, attempt } = limitedSetup();
    for (let i = 0; i < 4; i++) await attempt("wrong-pass", "203.0.113.1");

    clock.now += 11 * MINUTE_MS;
    await attempt("wrong-pass", "203.0.113.1");

    expect((await attempt(PASSWORD, "203.0.113.1")).status).toBe(302);
  });
});
