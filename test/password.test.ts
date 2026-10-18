import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createPasswordConfig } from "../src/password.js";

const MEMBERS_DIR = new URL("./fixtures/members", import.meta.url).pathname;

describe("createPasswordConfig", () => {
  it.each(["a".repeat(7), "a".repeat(13), ""])("8~12자가 아닌 비밀번호(%j)는 거부한다", (plain) => {
    expect(() => createPasswordConfig(plain)).toThrow("8~12자");
  });

  it.each(["a".repeat(8), "a".repeat(12)])("경계값 길이(%s)는 허용한다", (plain) => {
    expect(() => createPasswordConfig(plain)).not.toThrow();
  });

  it("출력값에 평문 비밀번호가 들어 있지 않다", () => {
    const config = createPasswordConfig("plain-pass-1");

    expect(JSON.stringify(config)).not.toContain("plain-pass-1");
  });

  it("같은 비밀번호도 호출마다 다른 해시와 세션 키를 만든다", () => {
    const a = createPasswordConfig("same-pass-12");
    const b = createPasswordConfig("same-pass-12");

    expect(a.passwordHash).not.toBe(b.passwordHash);
    expect(a.sessionSecret).not.toBe(b.sessionSecret);
  });

  it("만들어진 값으로 앱에 로그인할 수 있다", async () => {
    const app = createApp({ ...createPasswordConfig("works-12-ok"), membersDir: MEMBERS_DIR });

    const res = await app.request("/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "works-12-ok" }).toString(),
    });

    expect(res.status).toBe(302);
  });
});
