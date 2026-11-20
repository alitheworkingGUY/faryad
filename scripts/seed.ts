// `npm run seed` - wipes tickets, calls and incidents and loads the demo dataset.
// If the app is running, prefer Settings -> "Reset demo data": it also refreshes open screens.
import { getStore } from "../src/db";
import { seedDatabase } from "../src/db/seed";

const store = getStore();
const result = seedDatabase(store);
const areas = store.sqlite.prepare("SELECT COUNT(*) AS c FROM areas").get() as { c: number };
console.log(
  `Seeded ${areas.c} areas, 3 departments, ${result.tickets} tickets and ${result.calls} calls into data/faryad.db`,
);
store.sqlite.close();
