# Zaka-Bounty 🎯

> **The decentralized open-source bounty and escrow market on Stellar.**  
> Lock real value against real work. Ship. Get paid. Trustlessly.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Turborepo](https://img.shields.io/badge/built%20with-Turborepo-EF4444.svg)](https://turbo.build)
[![Stellar](https://img.shields.io/badge/Stellar-Soroban-7C3AED.svg)](https://stellar.org)
[![GitHub Org](https://img.shields.io/badge/GitHub-zakayola-181717.svg?logo=github)](https://github.com/zakayola)

**GitHub:** [`https://github.com/zakayola/Zaka-Bounty`](https://github.com/zakayola/Zaka-Bounty)

---

## What is Zaka-Bounty?

Zaka-Bounty is the ultimate Web3 tool for **incentivizing open-source contributions** on the Stellar network. It eliminates the trust problem in remote collaboration: a project maintainer can lock USDC (or any Stellar asset) into a Soroban smart contract vault tied to a specific GitHub issue or task description. A developer claims the bounty, completes the work, and the maintainer releases the funds — all enforced on-chain, with a built-in timeout/refund mechanism so funds are never trapped forever.

No middlemen. No escrow services. No invoice chasing.

### Why Zaka-Bounty?

| Problem | Zaka-Bounty Solution |
|---|---|
| Contributors don't trust bounty promises | Funds locked on-chain before work starts |
| Maintainers fear paying for bad work | `release_funds` only callable by maintainer |
| Abandoned bounties lock funds permanently | Timeout refund after configurable deadline |
| No visibility into open opportunities | Bounty Explorer UI with live on-chain state |

---

## Architecture

```
Zaka-Bounty/                    (Turborepo monorepo)
├── packages/
│   ├── contracts/              Rust / Soroban smart contract
│   │   ├── src/lib.rs          Escrow vault (create, claim, release, refund)
│   │   ├── Cargo.toml
│   │   └── deploy.sh           Stellar Testnet deployment script
│   ├── backend/                Node.js / Fastify / TypeScript
│   │   ├── src/
│   │   │   ├── server.ts       Fastify entry point
│   │   │   ├── db.ts           JSON file bounty store
│   │   │   └── routes/
│   │   │       └── bounties.ts REST endpoints
│   │   └── package.json
│   └── frontend/               Next.js 14 / Tailwind / TypeScript
│       ├── app/
│       │   ├── layout.tsx
│       │   └── page.tsx        Bounty Explorer
│       └── package.json
├── package.json                Turborepo root
├── turbo.json
├── README.md
└── CONTRIBUTING.md
```

### Escrow Logic

```
Maintainer                     Contract                       Developer
    |                              |                               |
    |── create_bounty(task, amt) ──▶  [OPEN] funds locked          |
    |                              |                               |
    |                              ◀── claim_bounty(address) ──────|
    |                              |   [CLAIMED] developer noted   |
    |                              |                               |
    |── release_funds() ──────────▶  [COMPLETED] pay developer     |
    |                              |                               |
    |                         [TIMEOUT] refund if deadline passed  |
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Rust + Soroban SDK 22 |
| Backend | Node.js 20 + Fastify 4 + TypeScript |
| Frontend | Next.js 14 + Tailwind CSS + TypeScript |
| Wallet | Freighter Browser Extension |
| SDK | `@stellar/stellar-sdk` |
| Monorepo | Turborepo 2 |

---

## Quickstart

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20.0.0 |
| npm | ≥ 10.0.0 |
| Rust | stable (rustup) |
| Stellar CLI | `cargo install stellar-cli` |

### 1. Clone the Repository

```bash
git clone https://github.com/zakayola/Zaka-Bounty.git
cd Zaka-Bounty
```

### 2. Install All Dependencies

```bash
npm install
```

This installs dependencies for all three packages via npm workspaces.

### 3. Configure Environment Variables

```bash
# Backend
cp packages/backend/.env.example packages/backend/.env

# Frontend
cp packages/frontend/.env.example packages/frontend/.env.local
```

Edit each `.env` file with your Stellar Testnet contract ID and backend URL.

### 4. Run the Full Dev Stack

```bash
npm run dev
```

Turborepo starts all three packages in parallel:
- **Frontend** → `http://localhost:3000`
- **Backend** → `http://localhost:4000`
- **Contracts** → compile with `cd packages/contracts && cargo build --target wasm32-unknown-unknown --release`

### 5. Deploy the Contract (Testnet)

```bash
cd packages/contracts
chmod +x deploy.sh
./deploy.sh
```

Copy the output `CONTRACT_ID` into your `.env` files.

### 6. Build for Production

```bash
npm run build
```

---

## API Reference (Backend)

| Method | Path | Description |
|---|---|---|
| `GET` | `/bounties` | List all bounties |
| `GET` | `/bounties?status=open` | Filter by status |
| `GET` | `/bounties?status=claimed` | Filter claimed bounties |
| `GET` | `/bounties?status=completed` | Filter completed bounties |
| `GET` | `/bounties/:id` | Get single bounty by ID |
| `POST` | `/bounties` | Index a new bounty |
| `PATCH` | `/bounties/:id/status` | Update bounty status |

---

## Smart Contract Methods

| Function | Caller | Description |
|---|---|---|
| `create_bounty` | Maintainer | Lock funds, set task + timeout |
| `claim_bounty` | Developer | Register as claimant |
| `release_funds` | Maintainer | Transfer funds to developer |
| `refund` | Maintainer | Reclaim funds after timeout |
| `get_bounty` | Anyone | Read bounty state |

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the Drips Wave contributor workflow and sprint issues.

---

## License

MIT © [AlAfiz](https://github.com/AlAfiz) / [zakayola](https://github.com/zakayola)
