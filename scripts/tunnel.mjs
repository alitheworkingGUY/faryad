// `npm run tunnel` - opens a Cloudflare quick tunnel to the local app and tells
// the app its public address, so every QR code points at it straight away.
// Run it in a second terminal while the app is running (`npm run demo`).
//
// Built for weak networks:
//  - It asks Cloudflare for the tunnel itself and waits up to a minute. (cloudflared's
//    own request gives up after a few seconds, which fails when Cloudflare is slow.)
//  - The address is published only once the tunnel is really connected.
//  - If the tunnel drops or Cloudflare deletes it, the address is withdrawn and a new
//    tunnel is opened, for as long as this script runs.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.PORT || "3000";
const local = `http://localhost:${port}`;
const QUICK_API = "https://api.trycloudflare.com/tunnel";

const here = dirname(fileURLToPath(import.meta.url));
const localCopies = [join(here, "..", "tools", "cloudflared.exe"), join(here, "..", "tools", "cloudflared")];
const installed = ["C:\\Program Files (x86)\\cloudflared\\cloudflared.exe", "C:\\Program Files\\cloudflared\\cloudflared.exe"];
const bin = [...localCopies, ...installed].find((c) => existsSync(c)) ?? "cloudflared";
const credsFile = join(tmpdir(), `faryad-tunnel-${process.pid}.json`);

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

/** Asks Cloudflare for a quick tunnel. Returns { id, hostname, account_tag, secret } or null. */
async function requestTunnel() {
  const parse = (text) => {
    try {
      const j = JSON.parse(text);
      return j?.success && j.result?.id && j.result?.hostname ? j.result : null;
    } catch {
      return null;
    }
  };
  try {
    const res = await fetch(QUICK_API, { method: "POST", signal: AbortSignal.timeout(60_000) });
    const result = parse(await res.text());
    if (result) return result;
  } catch {
    // fall through to curl
  }
  // Node's own networking sometimes stalls where curl gets through, so try that too.
  const curl = spawnSync("curl", ["-s", "-m", "60", "-X", "POST", QUICK_API], { encoding: "utf8" });
  return curl.status === 0 ? parse(curl.stdout) : null;
}

async function start() {
  if (stopping) return;
  tries++;
  console.log(`\n  Asking Cloudflare for a tunnel (attempt ${tries})...`);
  const tunnel = await requestTunnel();

  let args;
  let url = null; // the public address
  if (tunnel) {
    writeFileSync(
      credsFile,
      JSON.stringify({ AccountTag: tunnel.account_tag, TunnelSecret: tunnel.secret, TunnelID: tunnel.id }),
    );
    url = `https://${tunnel.hostname}`;
    args = ["tunnel", "--no-autoupdate", "--credentials-file", credsFile, "--url", local, "run", tunnel.id];
    console.log(`  Got ${url}. Connecting...`);
  } else {
    // Could not get one ourselves: let cloudflared try its own way this time.
    args = ["tunnel", "--url", local, "--no-autoupdate"];
    console.log("  No answer; letting cloudflared request the tunnel itself...");
  }

  const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
  current = child;
  let live = false; // true once the tunnel is actually carrying traffic

  // A tunnel that has not connected within 90 seconds is not going to: start over.
  const startupLimit = setTimeout(() => {
    if (!live) child.kill();
  }, 90_000);

  const onData = async (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    // After a network outage Cloudflare may have deleted the quick tunnel. cloudflared then
    // retries forever against a tunnel that no longer exists, so end it and get a new one.
    if (/Tunnel not found/i.test(text)) {
      console.log("\n  Cloudflare has dropped this tunnel (the connection was lost for too long). Getting a new one...\n");
      child.kill();
      return;
    }
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
    clearTimeout(startupLimit);
    if (err.code === "ENOENT") {
      console.error(
        "\nCould not find cloudflared. Install it with `winget install Cloudflare.cloudflared`, or put cloudflared.exe in the project's tools folder.\n",
      );
      process.exit(1);
    }
  });

  child.on("exit", async () => {
    clearTimeout(startupLimit);
    if (live) await tellApp("").catch(() => {}); // the address is dead now: stop showing it
    if (stopping) {
      rmSync(credsFile, { force: true });
      process.exit(0);
    }
    const wait = Math.min(15, 2 + tries);
    console.log(
      `\n  ${live ? "Tunnel closed" : `Tunnel attempt ${tries} did not connect`}; trying again in ${wait} seconds (Ctrl+C to stop)...\n`,
    );
    setTimeout(start, wait * 1000);
  });
}

process.on("SIGINT", () => {
  stopping = true;
  if (current && current.exitCode === null) current.kill();
  else {
    rmSync(credsFile, { force: true });
    process.exit(0);
  }
});

start();
