import "server-only";
import { MongoClient, type Db } from "mongodb";
import { env } from "./env";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function clientPromise(): Promise<MongoClient> {
  const uri = env.mongoUri();
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local (or your Vercel project settings).");
  // Reuse the connection across hot reloads and warm serverless invocations.
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri, { maxPoolSize: 10 }).connect();
    global._mongoClientPromise.catch(() => {
      global._mongoClientPromise = undefined;
    });
  }
  return global._mongoClientPromise;
}

let indexesReady: Promise<void> | null = null;

export async function getDb(): Promise<Db> {
  const db = (await clientPromise()).db(env.mongoDb());
  indexesReady ??= db
    .collection("forms")
    .createIndex({ slug: 1 }, { unique: true })
    .then(() => undefined)
    .catch((e) => {
      indexesReady = null;
      throw e;
    });
  await indexesReady;
  return db;
}
