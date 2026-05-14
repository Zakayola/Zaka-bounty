#!/usr/bin/env bash
# =============================================================================
# Zaka-Bounty — Stellar Testnet Deployment Script
# Repository: https://github.com/zakayola/Zaka-Bounty
# Author: AlAfiz <https://github.com/AlAfiz>
# =============================================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
NETWORK="testnet"
NETWORK_RPC="https://soroban-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
WASM_PATH="target/wasm32-unknown-unknown/release/zaka_bounty_contract.wasm"
IDENTITY="zaka-bounty-deployer"  # stellar CLI identity name

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
info "Starting Zaka-Bounty Testnet Deployment"
echo "────────────────────────────────────────────────"

command -v stellar >/dev/null 2>&1 || error "stellar CLI not found. Install: cargo install stellar-cli --features opt"
command -v cargo   >/dev/null 2>&1 || error "cargo not found. Install Rust: https://rustup.rs"

# ── Check / create identity ───────────────────────────────────────────────────
if stellar keys show "$IDENTITY" >/dev/null 2>&1; then
    info "Using existing identity: $IDENTITY"
else
    warn "Identity '$IDENTITY' not found. Generating new keypair..."
    stellar keys generate --no-fund "$IDENTITY"
    success "Identity created: $IDENTITY"
fi

DEPLOYER_ADDRESS=$(stellar keys address "$IDENTITY")
info "Deployer address: $DEPLOYER_ADDRESS"

# ── Fund via Friendbot ────────────────────────────────────────────────────────
info "Funding deployer via Friendbot..."
curl -sf "https://friendbot.stellar.org/?addr=${DEPLOYER_ADDRESS}" -o /dev/null \
    && success "Friendbot funded $DEPLOYER_ADDRESS" \
    || warn "Friendbot returned an error (account may already be funded)"

# ── Build WASM ────────────────────────────────────────────────────────────────
info "Building Soroban contract (wasm32 release)..."
cargo build \
    --target wasm32-unknown-unknown \
    --release \
    --quiet

success "WASM built: $WASM_PATH"

# ── Optimize WASM (if stellar optimize is available) ──────────────────────────
if stellar contract optimize --help >/dev/null 2>&1; then
    info "Optimizing WASM binary..."
    stellar contract optimize \
        --wasm "$WASM_PATH"
    WASM_PATH="${WASM_PATH%.wasm}.optimized.wasm"
    success "Optimized WASM: $WASM_PATH"
else
    warn "stellar contract optimize not available — skipping (install wasm-opt for smaller binary)"
fi

# ── Upload WASM ───────────────────────────────────────────────────────────────
info "Uploading WASM to Testnet..."
WASM_HASH=$(stellar contract upload \
    --network "$NETWORK" \
    --source "$IDENTITY" \
    --wasm "$WASM_PATH" \
    --rpc-url "$NETWORK_RPC" \
    --network-passphrase "$NETWORK_PASSPHRASE")

success "WASM uploaded. Hash: $WASM_HASH"

# ── Deploy Contract ───────────────────────────────────────────────────────────
info "Deploying contract instance..."
CONTRACT_ID=$(stellar contract deploy \
    --wasm-hash "$WASM_HASH" \
    --source "$IDENTITY" \
    --network "$NETWORK" \
    --rpc-url "$NETWORK_RPC" \
    --network-passphrase "$NETWORK_PASSPHRASE")

success "Contract deployed!"
echo ""
echo "════════════════════════════════════════════════"
echo -e "${GREEN}  CONTRACT_ID = $CONTRACT_ID${NC}"
echo "════════════════════════════════════════════════"
echo ""

# ── Write .env files ──────────────────────────────────────────────────────────
info "Writing CONTRACT_ID to environment files..."

# Backend
if [ -f "../backend/.env" ]; then
    # Update existing entry or append
    if grep -q "CONTRACT_ID=" "../backend/.env"; then
        sed -i "s|^CONTRACT_ID=.*|CONTRACT_ID=$CONTRACT_ID|" "../backend/.env"
    else
        echo "CONTRACT_ID=$CONTRACT_ID" >> "../backend/.env"
    fi
    success "Updated packages/backend/.env"
fi

# Frontend
if [ -f "../frontend/.env.local" ]; then
    if grep -q "NEXT_PUBLIC_CONTRACT_ID=" "../frontend/.env.local"; then
        sed -i "s|^NEXT_PUBLIC_CONTRACT_ID=.*|NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID|" "../frontend/.env.local"
    else
        echo "NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID" >> "../frontend/.env.local"
    fi
    success "Updated packages/frontend/.env.local"
fi

# ── Stellar Expert Link ───────────────────────────────────────────────────────
echo ""
info "View on Stellar Expert (Testnet):"
echo -e "  ${CYAN}https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID${NC}"
echo ""
success "Deployment complete! 🎯"
