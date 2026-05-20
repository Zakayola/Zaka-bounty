/*!
 * Zaka-Bounty Escrow Vault
 * ========================
 * Repository: https://github.com/zakayola/Zaka-Bounty
 * Author: AlAfiz <https://github.com/AlAfiz>
 * License: MIT
 *
 * # Escrow State Machine
 *
 *  create_bounty()                claim_bounty()             release_funds()
 *  ─────────────────              ──────────────             ───────────────
 *  NONE ──────────▶ OPEN ────────────────────▶ CLAIMED ───────────────────▶ COMPLETED
 *                    │                                                            ▲
 *                    │  refund() [after timeout]                                  │
 *                    └─────────────────────────────────────────────────────────▶ REFUNDED
 *
 * # Security Model
 * - Only the maintainer (creator) can release funds or refund.
 * - Only one developer can claim at a time (first-come, first-served).
 * - Timeout is set at creation; refund is available after that ledger sequence.
 * - Token transfers use the Soroban token interface (USDC / any SEP-41 asset).
 */

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, String, Symbol,
};

// ─────────────────────────────────────────────────────────────────────────────
// Data Types
// ─────────────────────────────────────────────────────────────────────────────

/// All possible states of a bounty through its lifecycle.
#[contracttype]
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum BountyStatus {
    /// Funds locked, awaiting a developer claimant.
    Open,
    /// A developer has registered; awaiting maintainer approval.
    Claimed,
    /// Funds released to the developer. Terminal state.
    Completed,
    /// Funds returned to maintainer after timeout. Terminal state.
    Refunded,
}

/// The on-chain record for a single bounty.
#[contracttype]
#[derive(Clone)]
pub struct BountyData {
    /// The account that created and funded this bounty (project maintainer).
    pub maintainer: Address,
    /// The Stellar token contract address (e.g., USDC on Testnet).
    pub token: Address,
    /// The amount of tokens locked in escrow (in stroops / base units).
    pub amount: i128,
    /// A short description or GitHub issue URL for the task.
    pub description: String,
    /// The developer who claimed the bounty. None until claimed.
    pub claimant: Option<Address>,
    /// Current lifecycle state.
    pub status: BountyStatus,
    /// Ledger sequence number after which the maintainer may refund.
    pub timeout_ledger: u32,
}

/// Ledger storage key enum — keeps storage access type-safe.
#[contracttype]
pub enum DataKey {
    /// Maps bounty_id (u64) → BountyData
    Bounty(u64),
    /// Monotonically increasing ID counter
    NextId,
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

const EVT_CREATED: Symbol   = symbol_short!("CREATED");
const EVT_CLAIMED: Symbol   = symbol_short!("CLAIMED");
const EVT_RELEASED: Symbol  = symbol_short!("RELEASED");
const EVT_REFUNDED: Symbol  = symbol_short!("REFUNDED");

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct ZakaBountyContract;

#[contractimpl]
impl ZakaBountyContract {
    // ── create_bounty ────────────────────────────────────────────────────────

    /// Lock `amount` tokens from the caller into escrow and open a new bounty.
    ///
    /// # Arguments
    /// * `maintainer`       - Must authorize this call; is the sole fund releaser.
    /// * `token`            - SEP-41 token contract address (e.g., USDC).
    /// * `amount`           - Token amount in base units (must be > 0).
    /// * `description`      - Task description or GitHub issue URL.
    /// * `timeout_ledgers`  - Number of ledgers from now before a refund is allowed.
    ///
    /// # Returns
    /// The unique `bounty_id` for this bounty.
    pub fn create_bounty(
        env: Env,
        maintainer: Address,
        token: Address,
        amount: i128,
        description: String,
        timeout_ledgers: u32,
    ) -> u64 {
        maintainer.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }
        if timeout_ledgers == 0 {
            panic!("timeout_ledgers must be > 0");
        }

        // Transfer tokens from maintainer into the contract's own address (escrow).
        let client = token::Client::new(&env, &token);
        client.transfer(&maintainer, &env.current_contract_address(), &amount);

        // Assign and increment bounty ID.
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0u64);
        env.storage()
            .instance()
            .set(&DataKey::NextId, &(id + 1));

        let timeout_ledger = env.ledger().sequence() + timeout_ledgers;

        let bounty = BountyData {
            maintainer: maintainer.clone(),
            token,
            amount,
            description,
            claimant: None,
            status: BountyStatus::Open,
            timeout_ledger,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Bounty(id), &bounty);

        env.events().publish(
            (EVT_CREATED, id),
            (maintainer, amount, timeout_ledger),
        );

        id
    }

    // ── claim_bounty ─────────────────────────────────────────────────────────

    /// Register `developer` as the claimant for the given bounty.
    ///
    /// The bounty must be in `Open` status. Only one claimant is accepted
    /// (first-come, first-served). The developer must authorize this call.
    pub fn claim_bounty(env: Env, bounty_id: u64, developer: Address) {
        developer.require_auth();

        let mut bounty: BountyData = env
            .storage()
            .persistent()
            .get(&DataKey::Bounty(bounty_id))
            .expect("bounty not found");

        if bounty.status != BountyStatus::Open {
            panic!("bounty is not open");
        }

        bounty.claimant = Some(developer.clone());
        bounty.status = BountyStatus::Claimed;

        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        env.events()
            .publish((EVT_CLAIMED, bounty_id), developer);
    }

    // ── release_funds ────────────────────────────────────────────────────────

    /// Transfer escrowed funds to the claimant. Callable only by the maintainer.
    ///
    /// The bounty must be in `Claimed` status (a developer must have registered).
    pub fn release_funds(env: Env, bounty_id: u64) {
        let mut bounty: BountyData = env
            .storage()
            .persistent()
            .get(&DataKey::Bounty(bounty_id))
            .expect("bounty not found");

        // Only the original maintainer may release funds.
        bounty.maintainer.require_auth();

        if bounty.status != BountyStatus::Claimed {
            panic!("bounty must be in Claimed status to release funds");
        }

        let developer = bounty.claimant.clone().expect("no claimant registered");

        let client = token::Client::new(&env, &bounty.token);
        client.transfer(&env.current_contract_address(), &developer, &bounty.amount);

        bounty.status = BountyStatus::Completed;
        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        env.events()
            .publish((EVT_RELEASED, bounty_id), (developer, bounty.amount));
    }

    // ── refund ───────────────────────────────────────────────────────────────

    /// Return escrowed funds to the maintainer if the timeout ledger has passed.
    ///
    /// Can be called on bounties in `Open` OR `Claimed` status, giving both
    /// maintainer and developer a clear expectation that uncompleted work can
    /// be reclaimed after the deadline.
    pub fn refund(env: Env, bounty_id: u64) {
        let mut bounty: BountyData = env
            .storage()
            .persistent()
            .get(&DataKey::Bounty(bounty_id))
            .expect("bounty not found");

        bounty.maintainer.require_auth();

        if bounty.status == BountyStatus::Completed
            || bounty.status == BountyStatus::Refunded
        {
            panic!("bounty is already finalized");
        }

        if env.ledger().sequence() < bounty.timeout_ledger {
            panic!("timeout has not elapsed yet");
        }

        let client = token::Client::new(&env, &bounty.token);
        client.transfer(
            &env.current_contract_address(),
            &bounty.maintainer,
            &bounty.amount,
        );

        bounty.status = BountyStatus::Refunded;
        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        env.events()
            .publish((EVT_REFUNDED, bounty_id), bounty.amount);
    }

    // ── get_bounty ───────────────────────────────────────────────────────────

    /// Read the current state of a bounty. Anyone may call this.
    pub fn get_bounty(env: Env, bounty_id: u64) -> BountyData {
        env.storage()
            .persistent()
            .get(&DataKey::Bounty(bounty_id))
            .expect("bounty not found")
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        token::{Client as TokenClient, StellarAssetClient},
        Env, String,
    };

    /// Bootstrap a test environment with a mock token and funded maintainer.
    fn setup() -> (Env, Address, Address, Address, ZakaBountyContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ZakaBountyContract());
        let client = ZakaBountyContractClient::new(&env, &contract_id);

        let maintainer = Address::generate(&env);
        let developer = Address::generate(&env);

        // Create a mock Stellar asset (simulates USDC).
        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_id = token_contract.address();
        let asset_client = StellarAssetClient::new(&env, &token_id);

        // Fund the maintainer with 10_000 tokens.
        asset_client.mint(&maintainer, &10_000);

        (env, maintainer, developer, token_id, client)
    }

    #[test]
    fn test_full_happy_path() {
        let (env, maintainer, developer, token, client) = setup();

        // Create bounty with 500-ledger timeout.
        let id = client.create_bounty(
            &maintainer,
            &token,
            &500,
            &String::from_str(&env, "Fix issue #42"),
            &500,
        );
        assert_eq!(id, 0);

        let bounty = client.get_bounty(&id);
        assert_eq!(bounty.status, BountyStatus::Open);
        assert_eq!(bounty.amount, 500);

        // Developer claims.
        client.claim_bounty(&id, &developer);
        let bounty = client.get_bounty(&id);
        assert_eq!(bounty.status, BountyStatus::Claimed);
        assert_eq!(bounty.claimant, Some(developer.clone()));

        // Maintainer releases funds.
        client.release_funds(&id);
        let bounty = client.get_bounty(&id);
        assert_eq!(bounty.status, BountyStatus::Completed);

        // Verify the developer received the tokens.
        let token_client = TokenClient::new(&env, &token);
        assert_eq!(token_client.balance(&developer), 500);
    }

    #[test]
    fn test_refund_after_timeout() {
        let (env, maintainer, _developer, token, client) = setup();

        let id = client.create_bounty(
            &maintainer,
            &token,
            &300,
            &String::from_str(&env, "Implement feature X"),
            &100, // timeout in 100 ledgers
        );

        // Advance ledger sequence past the timeout.
        env.ledger().set(LedgerInfo {
            sequence_number: 200,
            timestamp: 12345,
            ..Default::default()
        });

        let token_client = TokenClient::new(&env, &token);
        let balance_before = token_client.balance(&maintainer);

        client.refund(&id);

        let bounty = client.get_bounty(&id);
        assert_eq!(bounty.status, BountyStatus::Refunded);
        assert_eq!(token_client.balance(&maintainer), balance_before + 300);
    }

    #[test]
    #[should_panic(expected = "timeout has not elapsed yet")]
    fn test_refund_before_timeout_panics() {
        let (env, maintainer, _developer, token, client) = setup();

        let id = client.create_bounty(
            &maintainer,
            &token,
            &100,
            &String::from_str(&env, "Task Y"),
            &500, // timeout well in the future
        );

        // Ledger hasn't advanced far enough — should panic.
        client.refund(&id);
    }

    #[test]
    #[should_panic(expected = "bounty is not open")]
    fn test_double_claim_panics() {
        let (env, maintainer, developer, token, client) = setup();

        let id = client.create_bounty(
            &maintainer,
            &token,
            &200,
            &String::from_str(&env, "Task Z"),
            &500,
        );

        client.claim_bounty(&id, &developer);
        // Second claim on an already-claimed bounty must panic.
        let interloper = Address::generate(&env);
        client.claim_bounty(&id, &interloper);
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_zero_amount_panics() {
        let (env, maintainer, _developer, token, client) = setup();
        client.create_bounty(
            &maintainer,
            &token,
            &0,
            &String::from_str(&env, "Invalid"),
            &100,
        );
    }
}
