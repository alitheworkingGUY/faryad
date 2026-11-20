// `npm run demo:call [scenario] [speed]` - plays a scripted call on the running app.
// Scenarios: gulbahar-water (default), hayatabad-streetlight, saddar-garbage
const base = process.env.FARYAD_URL || "http://localhost:3000";
const [scenario, speed] = process.argv.slice(2);

async function main() {
  const res = await fetch(`${base}/api/demo/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, speed: speed ? Number(speed) : 1 }),
  });
  if (!res.ok) throw new Error(`The app answered ${res.status}. Is \`npm run dev\` running on ${base}?`);
  const data = (await res.json()) as { callId: string; scenario: string };
  console.log(`Simulated call started (${data.scenario}). Watch the Command Center at ${base}/`);
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
