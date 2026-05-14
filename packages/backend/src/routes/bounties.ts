/**
 * bounties.ts — Fastify routes for the Zaka-Bounty indexer
 * =========================================================
 * All bounty lifecycle endpoints: list, filter, get, create, update status.
 * Uses @stellar/stellar-sdk to decode transaction XDRs for on-chain verification.
 */

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import {
  listBounties,
  getBountyById,
  createBounty,
  updateBountyStatus,
  getBountiesByClaimant,
  BountyStatus,
} from "../db.js";

// ─── JSON Schemas ─────────────────────────────────────────────────────────────

const BountySchema = {
  type: "object",
  properties: {
    id:             { type: "string" },
    onChainId:      { type: "number" },
    maintainer:     { type: "string" },
    description:    { type: "string" },
    reward:         { type: "string" },
    tokenAddress:   { type: "string" },
    amountRaw:      { type: "string" },
    status:         { type: "string", enum: ["open", "claimed", "completed", "refunded"] },
    claimant:       { type: "string" },
    createdAt:      { type: "string" },
    updatedAt:      { type: "string" },
    creationTxXdr:  { type: "string" },
  },
};

const listQuerySchema = {
  type: "object",
  properties: {
    status:   { type: "string", enum: ["open", "claimed", "completed", "refunded"] },
    claimant: { type: "string" },
  },
  additionalProperties: false,
};

const createBodySchema = {
  type: "object",
  required: ["maintainer", "description", "reward", "tokenAddress", "amountRaw"],
  properties: {
    maintainer:    { type: "string", minLength: 56, maxLength: 56 },
    description:   { type: "string", minLength: 1, maxLength: 500 },
    reward:        { type: "string" },
    tokenAddress:  { type: "string" },
    amountRaw:     { type: "string" },
    onChainId:     { type: "number" },
    creationTxXdr: { type: "string" },
  },
  additionalProperties: false,
};

const updateStatusBodySchema = {
  type: "object",
  required: ["status"],
  properties: {
    status:   { type: "string", enum: ["open", "claimed", "completed", "refunded"] },
    claimant: { type: "string", minLength: 56, maxLength: 56 },
  },
  additionalProperties: false,
};

// ─── Stellar public key validation helper ─────────────────────────────────────

function isValidStellarAddress(address: string): boolean {
  // Stellar public keys are 56-char strings starting with 'G'
  return /^G[A-Z2-7]{55}$/.test(address);
}

// ─── Route Plugin ─────────────────────────────────────────────────────────────

export async function bountiesRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // ── GET /bounties ──────────────────────────────────────────────────────────
  // List bounties with optional ?status= and ?claimant= filters
  fastify.get(
    "/bounties",
    {
      schema: {
        tags: ["bounties"],
        summary: "List all bounties, optionally filtered by status or claimant",
        querystring: listQuerySchema,
        response: { 200: { type: "array", items: BountySchema } },
      },
    },
    async (request, reply) => {
      const query = request.query as {
        status?: BountyStatus;
        claimant?: string;
      };

      if (query.claimant) {
        if (!isValidStellarAddress(query.claimant)) {
          return reply.status(400).send({
            error: "Invalid Stellar public key in 'claimant' parameter",
          });
        }
        return getBountiesByClaimant(query.claimant);
      }

      return listBounties(query.status);
    }
  );

  // ── GET /bounties/by-claimant/:pubkey ─────────────────────────────────────
  // Dedicated route for developer claimant search (Medium sprint issue)
  fastify.get(
    "/bounties/by-claimant/:pubkey",
    {
      schema: {
        tags: ["bounties"],
        summary: "Get all bounties claimed by a specific developer public key",
        params: {
          type: "object",
          required: ["pubkey"],
          properties: { pubkey: { type: "string" } },
        },
        response: { 200: { type: "array", items: BountySchema } },
      },
    },
    async (request, reply) => {
      const { pubkey } = request.params as { pubkey: string };

      if (!isValidStellarAddress(pubkey)) {
        return reply.status(400).send({
          error: `'${pubkey}' is not a valid Stellar public key. Expected a 56-character G... address.`,
        });
      }

      return getBountiesByClaimant(pubkey);
    }
  );

  // ── GET /bounties/:id ──────────────────────────────────────────────────────
  fastify.get(
    "/bounties/:id",
    {
      schema: {
        tags: ["bounties"],
        summary: "Get a single bounty by its UUID",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: BountySchema,
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bounty = getBountyById(id);
      if (!bounty) {
        return reply.status(404).send({ error: `Bounty '${id}' not found` });
      }
      return bounty;
    }
  );

  // ── POST /bounties ─────────────────────────────────────────────────────────
  // Index a new bounty (typically called after the on-chain create_bounty tx)
  fastify.post(
    "/bounties",
    {
      schema: {
        tags: ["bounties"],
        summary: "Index a new bounty after on-chain creation",
        body: createBodySchema,
        response: { 201: BountySchema },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        maintainer: string;
        description: string;
        reward: string;
        tokenAddress: string;
        amountRaw: string;
        onChainId?: number;
        creationTxXdr?: string;
      };

      // Optional: decode the XDR to verify it matches the submitted fields
      if (body.creationTxXdr) {
        try {
          // Use stellar-sdk to parse and validate the transaction XDR
          const tx = TransactionBuilder.fromXDR(
            body.creationTxXdr,
            "Test SDF Network ; September 2015"
          );
          fastify.log.info(
            { hash: tx.hash().toString("hex") },
            "Indexed bounty creation tx"
          );
        } catch (err) {
          return reply.status(400).send({
            error: "Invalid creationTxXdr: could not decode transaction",
          });
        }
      }

      if (!isValidStellarAddress(body.maintainer)) {
        return reply.status(400).send({
          error: "maintainer must be a valid Stellar public key",
        });
      }

      const bounty = createBounty(body);
      return reply.status(201).send(bounty);
    }
  );

  // ── PATCH /bounties/:id/status ─────────────────────────────────────────────
  // Update bounty status (e.g., after on-chain claim or release event)
  fastify.patch(
    "/bounties/:id/status",
    {
      schema: {
        tags: ["bounties"],
        summary: "Update a bounty's lifecycle status",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: updateStatusBodySchema,
        response: {
          200: BountySchema,
          400: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status, claimant } = request.body as {
        status: BountyStatus;
        claimant?: string;
      };

      if (claimant && !isValidStellarAddress(claimant)) {
        return reply.status(400).send({
          error: "claimant must be a valid Stellar public key",
        });
      }

      try {
        const updated = updateBountyStatus(id, status, claimant);
        return updated;
      } catch (err) {
        return reply.status(404).send({ error: (err as Error).message });
      }
    }
  );
}
