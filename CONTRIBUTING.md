# Contributing to Zaka-Bounty 🤝

Welcome to the **Zaka-Bounty** contributor community — part of the **Stellar Drips Wave** open-source grant program. This document defines the workflow for Drips Wave sprint contributors.

**Repository:** [`https://github.com/zakayola/Zaka-Bounty`](https://github.com/zakayola/Zaka-Bounty)  
**Maintainer:** [@AlAfiz](https://github.com/AlAfiz) | **Org:** [zakayola](https://github.com/zakayola)

---

## Code of Conduct

All contributors must adhere to respectful, inclusive collaboration. Harassment or exclusionary behaviour will result in removal from the program. See [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

---

## Drips Wave Sprint Workflow

### 1. Find a Bounty Issue

Browse open GitHub Issues tagged `drips-wave` and `bounty`. Each issue declares its **point value** and **acceptance criteria**.

### 2. Claim the Issue

Comment `I'm claiming this bounty` on the GitHub issue. The maintainer will assign it to you within 24 hours. Do not open a PR without assignment.

### 3. Fork & Branch

```bash
git clone https://github.com/zakayola/Zaka-Bounty.git
cd Zaka-Bounty
git checkout -b feat/<issue-number>-short-description
```

### 4. Develop

Run the full stack locally:

```bash
npm install
npm run dev
```

Follow the coding standards:
- **TypeScript**: Strict mode, no `any` without justification comment
- **Rust**: `cargo fmt` + `cargo clippy` must pass clean
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`)

### 5. Test Your Changes

```bash
# TypeScript packages
npm run test

# Rust contract
cd packages/contracts && cargo test

# Lint everything
npm run lint
```

### 6. Open a Pull Request

Target branch: `main`  
PR title format: `[#<issue>] Short description`  
Fill in the PR template. Link to the bounty issue. Paste your Stellar Testnet wallet address for payment.

### 7. Review & Payment

The maintainer reviews within 3 business days. On approval and merge, the on-chain `release_funds` transaction is submitted and your USDC bounty is released. You can track it live in the Bounty Explorer at `http://localhost:3000`.

---

## Sprint Issues & Point Values

> Points are denominated in Drips Wave contribution scores. USD bounty values are determined by the maintainer per sprint and locked into the on-chain contract before work begins.

---

### 🟢 Trivial — 100 Points

**Issue: Update Frontend Typography & Add "How It Works" Section**

**Scope:** `packages/frontend`

**Acceptance Criteria:**
- Replace the current system font stack with [Inter](https://fonts.google.com/specimen/Inter) loaded via `next/font/google`
- Apply `font-sans` consistently across headings and body text in Tailwind config
- Add a new `HowItWorks` component rendered on the home page (`app/page.tsx`) below the Bounty Explorer
- The section must include three steps with icons: **1. Maintainer locks funds → 2. Developer claims bounty → 3. Maintainer releases payment**
- All three steps must be responsive (stacked on mobile, horizontal on desktop)
- Passes `npm run lint` with no errors

**Files likely touched:**
- `packages/frontend/app/layout.tsx`
- `packages/frontend/tailwind.config.ts`
- `packages/frontend/components/HowItWorks.tsx` *(new)*
- `packages/frontend/app/page.tsx`

---

### 🟡 Medium — 150 Points

**Issue: Add Fastify Endpoint to Search Bounties by Developer Public Key**

**Scope:** `packages/backend`

**Acceptance Criteria:**
- Add a new query parameter `claimant` to `GET /bounties` — e.g. `GET /bounties?claimant=G...`
- Filter returns only bounties where `bounty.claimant` matches the provided Stellar public key
- Validate the public key with `@stellar/stellar-sdk` — reject invalid keys with HTTP 400 and a descriptive error
- Add a dedicated route `GET /bounties/by-claimant/:pubkey` as an alias
- Include a JSON schema definition for Fastify's request validation
- Write at least 2 tests in `src/routes/bounties.test.ts` covering the happy path and invalid key

**Files likely touched:**
- `packages/backend/src/routes/bounties.ts`
- `packages/backend/src/routes/bounties.test.ts` *(new)*
- `packages/backend/src/db.ts`

---

### 🔴 High — 200 Points

**Issue: Implement Arbiter Multi-Sig Dispute Resolution in Rust Contract**

**Scope:** `packages/contracts`

**Background:** Currently, fund release is unilateral — the maintainer calls `release_funds`. This creates a power imbalance if the maintainer disputes the work unfairly. An Arbiter system introduces a neutral third party to resolve disputes.

**Acceptance Criteria:**
- Add an `arbiter: Address` field to the `BountyData` struct, set at `create_bounty` time
- Implement a `dispute` function callable by either the maintainer or developer to flag a bounty as `BountyStatus::Disputed`
- Implement `arbiter_release(bounty_id, recipient: Address)` callable **only** by the arbiter — releases funds to the specified recipient (either developer or maintainer for a refund)
- Arbiter cannot be the same address as maintainer or developer (validated at `create_bounty`)
- Add a `BountyStatus::Disputed` variant to the enum
- All new functions must have accompanying `#[cfg(test)]` unit tests
- `cargo test` must pass clean

**Files likely touched:**
- `packages/contracts/src/lib.rs`
- `packages/contracts/src/types.rs` *(if applicable)*

---

## Development Environment Setup

```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Stellar CLI
cargo install stellar-cli --features opt

# Install Node.js 20+ (via nvm recommended)
nvm install 20
nvm use 20

# Clone and bootstrap
git clone https://github.com/zakayola/Zaka-Bounty.git
cd Zaka-Bounty
npm install
```

---

## Questions?

Open a [GitHub Discussion](https://github.com/zakayola/Zaka-Bounty/discussions) or ping [@AlAfiz](https://github.com/AlAfiz) in the issue thread.

Happy hacking! 🚀
