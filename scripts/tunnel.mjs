// `npm run tunnel` - opens a Cloudflare quick tunnel to the local app and tells
// the app its public address, so every QR code points at it straight away.
// Run it in a second terminal while `npm run dev` is running.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.PORT || "3000";
const local = `http://localhost:${port}`;

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  "cloudflared",
  // a copy kept next to the project (tools/ is git-ignored)
  join(here, "..", "tools", "cloudflared.exe"),
  join(here, "..", "tools", "cloudflared"),
  "C:\Program Files (x86)\cloudflared\cloudflared.exe",
  "C:\Program Files\cloudflared\cloudflared.exe",
];
const bin = candidates.find((c) => c === "cloudflared" || existsSync(c)) ?? "cloudflared";
const fallback = candidates.slice(1).find((c) => existsSync(c));

function start(command) {
  const child = spawn(command, ["tunnel", "--url", local, "--no-autoupdate"], { stdio: ["ignore", "pipe", "pipe"] });
  let announced = false;

  const onData = async (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (announced) return;
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (!match) return;
    announced = true;
    const url = match[0];
    try {
      const res = await fetch(`${local}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicBaseUrl: url }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`\n\n  Faryad is public at:   ${url}`);
      console.log(`  Citizen call page:     ${url}/call`);
      console.log(`  Officer app:           ${url}/officer`);
      console.log("  QR codes on the Command Center and Settings now use this address.\n");
    } catch (err) {
      console.log(`\n\n  Tunnel is up at ${url}, but the app could not be told (${err.message}).`);
      console.log(`  Is \`npm run dev\` running on ${local}? Paste the URL into Settings -> Public URL.\n`);
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  child.on("error", (err) => {
    if (err.code === "ENOENT" && command === "cloudflared" && fallback) {
      start(fallback);
      return;
    }
    console.error("\nCould not start cloudflared. Install it with:  winget install Cloudflare.cloudflared\n");
    process.exit(1);
  });
  child.on("exit", (code) => {
    if (code !== null) process.exit(code);
  });
  process.on("SIGINT", () => child.kill());
}

start(bin);
