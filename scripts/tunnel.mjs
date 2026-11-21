// `npm run tunnel` - opens a Cloudflare quick tunnel to the local app and tells
// the app its public address, so every QR code points at it straight away.
// Run it in a second terminal while the app is running (`npm run demo`).
//
// On a weak network Cloudflare can be slow to hand out a tunnel, and a tunnel can
// drop. This helper keeps trying until one is really connected, publishes the
// address only then, and withdraws it if the tunnel goes away.
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
  "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
  "C:\\Program Files\\cloudflared\\cloudflared.exe",
];
const fallback = candidates.slice(1).find((c) => existsSync(c));

let stopping = false;
let current = null;
let tries = 0;

async function tellApp(url) {
  const res = await fetch(`${local}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicBaseUrl: url }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

function start(command) {
  tries++;
  const child = spawn(command, ["tunnel", "--url", local, "--no-autoupdate"], { stdio: ["ignore", "pipe", "pipe"] });
  current = child;
  let url = null; // the address Cloudflare assigned
  let live = false; // true once the tunnel is actually carrying traffic

  const onData = async (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    // The tunnel's own address, not api.trycloudflare.com (which appears in error messages).
    if (!url) url = text.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/i)?.[0] ?? null;
    // An address alone is not enough: wait until cloudflared has registered a connection.
    if (url && !live && /Registered tunnel connection/i.test(text)) {
      live = true;
      tries = 0;
      try {
        await tellApp(url);
        console.log(`\n\n  Faryad is public at:   ${url}`);
        console.log(`  Citizen call page:     ${url}/call`);
        console.log(`  Officer app:           ${url}/officer`);
        console.log("  QR codes on the Command Center and Settings now use this address.\n");
      } catch (err) {
        console.log(`\n\n  Tunnel is up at ${url}, but the app could not be told (${err.message}).`);
        console.log(`  Is the app running on ${local}? Paste the URL into Settings -> Public URL.\n`);
      }
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

  child.on("exit", async () => {
    if (current !== child) return; // replaced by the fallback binary
    if (live) {
      // The address is dead now: stop showing it in QR codes.
      await tellApp("").catch(() => {});
    }
    if (stopping) process.exit(0);
    const wait = Math.min(15, 3 + tries);
    console.log(
      `\n  ${live ? "Tunnel closed" : `Tunnel attempt ${tries} did not connect`}; trying again in ${wait} seconds (Ctrl+C to stop)...\n`,
    );
    setTimeout(() => start(command), wait * 1000);
  });
}

process.on("SIGINT", () => {
  stopping = true;
  if (current) current.kill();
  else process.exit(0);
});

start(existsSync(candidates[1]) || existsSync(candidates[2]) ? fallback : "cloudflared");
