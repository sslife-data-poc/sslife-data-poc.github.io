import { createPasswordConfig } from "../src/password.js";

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let input = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\u0003") process.exit(130);
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(input);
        }
        if (ch === "\u007f") input = [...input].slice(0, -1).join("");
        else input += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const plain = await promptHidden("새 공유 비밀번호 (8~12자): ");
const confirm = await promptHidden("다시 입력: ");
if (plain !== confirm) {
  console.error("입력이 일치하지 않습니다.");
  process.exit(1);
}

try {
  const { passwordHash, sessionSecret } = createPasswordConfig(plain);
  console.log("\nRender 대시보드의 환경변수에 아래 두 값을 설정하세요 (저장소에는 올리지 마세요):\n");
  console.log(`PASSWORD_HASH=${passwordHash}`);
  console.log(`SESSION_SECRET=${sessionSecret}`);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
