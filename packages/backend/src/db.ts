/**
 * db.ts — Local JSON file bounty store
 * =====================================
 * Provides a simple, file-backed persistence layer for off-chain bounty
 * metadata. In production this would be replaced by PostgreSQL or a graph
 * indexer, but for Drips Wave demos a JSON file is transparent and zero-ops.
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BountyStatus = "open" | "claimed" | "completed" | "refunded";

export interface Bounty {
  /** Unique off-chain identifier (UUID v4) */
  id: string;
  /** On-chain Soroban bounty ID */
  onChainId?: number;
  /** Stellar address of the maintainer who created the bounty */
  maintainer: string;
  /** Task description or GitHub issue URL */
  description: string;
  /** Reward amount (human-readable, e.g. "150 USDC") */
  reward: string;
  /** Token contract address (e.g., USDC on Testnet) */
  tokenAddress: string;
  /** Raw amount in base units */
  amountRaw: string;
  /** Current lifecycle state */
  status: BountyStatus;
  /** Stellar address of the developer who claimed, if any */
  claimant?: string;
  /** ISO 8601 timestamp when the bounty was created */
  createdAt: string;
  /** ISO 8601 timestamp of last status update */
  updatedAt: string;
  /** XDR of the creation transaction (for on-chain verification) */
  creationTxXdr?: string;
}

export interface BountyStore {
  bounties: Bounty[];
}

// ─── File Path ────────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../data");
const DB_PATH = path.join(DATA_DIR, "bounties.json");

// ─── Initialise ───────────────────────────────────────────────────────────────

function ensureStore(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ bounties: [] }, null, 2));
  }
}

function readStore(): BountyStore {
  ensureStore();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw) as BountyStore;
}

function writeStore(store: BountyStore): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

/** Return all bounties, optionally filtered by status. */
export function listBounties(status?: BountyStatus): Bounty[] {
  const store = readStore();
  if (status) {
    return store.bounties.filter((b) => b.status === status);
  }
  return store.bounties;
}

/** Return a single bounty by its UUID. */
export function getBountyById(id: string): Bounty | undefined {
  const store = readStore();
  return store.bounties.find((b) => b.id === id);
}

/** Index a new bounty. Returns the created record. */
export function createBounty(
  input: Omit<Bounty, "id" | "createdAt" | "updatedAt" | "status">
): Bounty {
  const store = readStore();
  const now = new Date().toISOString();
  const bounty: Bounty = {
    ...input,
    id: randomUUID(),
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  store.bounties.push(bounty);
  writeStore(store);
  return bounty;
}

/** Update the status (and optional claimant) of an existing bounty. */
export function updateBountyStatus(
  id: string,
  status: BountyStatus,
  claimant?: string
): Bounty {
  const store = readStore();
  const idx = store.bounties.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error(`Bounty ${id} not found`);

  store.bounties[idx]!.status = status;
  store.bounties[idx]!.updatedAt = new Date().toISOString();
  if (claimant) {
    store.bounties[idx]!.claimant = claimant;
  }

  writeStore(store);
  return store.bounties[idx]!;
}

/** Search bounties by developer claimant address. */
export function getBountiesByClaimant(claimant: string): Bounty[] {
  const store = readStore();
  return store.bounties.filter((b) => b.claimant === claimant);
}
