// Verifies MONGODB_URI from .env.local: connects, pings, and lists collections.
// Usage: npm run db:check
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "voyathra";
const masked = (uri || "").replace(/\/\/([^:@/]+):[^@]*@/, "//$1:****@");

if (!uri) {
  console.error("✗ MONGODB_URI is not set in .env.local");
  process.exit(1);
}
if (/<db_(username|password)>/.test(uri)) {
  console.error("✗ Replace <db_username> and <db_password> (including the < >) with your real Atlas database user and password.");
  process.exit(1);
}

console.log(`Connecting to ${masked} (db: ${dbName}) …`);
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(dbName);
  await db.command({ ping: 1 });
  const cols = await db.listCollections().toArray();
  console.log(`✓ Connected. Collections in "${dbName}": ${cols.map((c) => c.name).join(", ") || "(none yet — created on first form)"}`);
} catch (e) {
  const msg = String(e?.message || e);
  console.error("✗ Connection failed:", msg);
  if (/auth|Authentication/i.test(msg)) console.error("  → Wrong database username/password. Use the Database Access user (not your Atlas login). URL-encode special characters in the password (e.g. @ → %40, # → %23, / → %2F).");
  if (/Server selection|timed out|ENOTFOUND|querySrv|alert number 80|tlsv1 alert/i.test(msg)) console.error("  → Atlas → Network Access → Add IP Address → 'Allow access from anywhere' (0.0.0.0/0), and check the cluster host name.");
  process.exitCode = 1;
} finally {
  await client.close();
}
