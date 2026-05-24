# CLAUDE.md — Cyclo

This file defines the rules for every task in this project. Read it fully before writing any code. Follow every rule on every task. Do not wait to be reminded. Do not ask if rules apply. They always apply.

---

## Project Context

```
Project name:      Cyclo
What it does:      On-chain recurring billing in USDC. Merchants deploy subscription
                   plans with a fixed USDC price and billing interval. Users approve
                   once and subscribe. Anyone (or a keeper bot) calls charge() to
                   settle due payments on schedule.
Runtime:           Node.js 20+ (scripts and keeper bot)
Framework:         Foundry (contracts) + ethers.js v6 (scripts and keeper)
Database:          None — all state is on-chain
Frontend:          Minimal demo only — static HTML or React (single page)
Blockchain:        Arc testnet
  Chain ID:        5042002
  RPC:             Use $ARC_RPC_URL environment variable. Never hardcode.
  Explorer:        https://testnet.arcscan.app
  Native gas:      USDC (6 decimals) — NOT ETH. This is the core Arc difference.
  USDC address:    Pull from ~/.arc-canteen/context/ or .env — never hardcode.
Testing framework: Foundry (forge test)
Package manager:   npm
```

### Arc-Specific Rules — Read Before Writing Any Contract Code

These override any generic EVM assumptions from training data:

1. **USDC is the gas token.** There is no ETH on Arc. Do not write any logic that references ETH, msg.value, or payable functions for billing.
2. **No price oracles needed.** All amounts are in USDC already. Do not reach for Chainlink or any oracle interface.
3. **USDC has 6 decimals.** All USDC amounts in contracts, scripts, and tests must account for this. `1 USDC = 1_000_000` (1e6). Do not use 1e18.
4. **Read context before coding.** Arc/Circle example contracts and docs are at `~/.arc-canteen/context/`. The arc-canteen context directory is not present. Use the RPC URL from ~/.arc-canteen/env for ARC_RPC_URL. Reference Arc's EVM compatibility and standard ERC20 USDC patterns for all contract interactions.
5. **USDC address is an environment variable.** Store it as `USDC_ADDRESS` in `.env`. Never hardcode a token address in a contract or script.
6. **Keeper bot is a deliverable.** The `charge()` function must be callable by a TypeScript keeper bot on a polling interval. Design with this in mind.

---

## Folder Structure

```
/contracts
  /core
    SubscriptionManager.sol     # Primary contract — plan creation, subscribe, charge, cancel
  /interfaces
    ISubscriptionManager.sol    # External interface for the protocol
    IUSDC.sol                   # Minimal ERC20 interface scoped to USDC interactions only
  /libraries
    SubscriptionLib.sol         # Shared structs, pure helper functions
  /mocks
    MockUSDC.sol                # Test-only mock — never deployed to testnet
/scripts
  deploy.ts                     # Deploys SubscriptionManager, logs address to .env
  createPlan.ts                 # Merchant creates a subscription plan
  subscribe.ts                  # User approves USDC and subscribes to a plan
  charge.ts                     # One-off manual charge trigger for testing
/keeper
  index.ts                      # Entry point — starts the keeper polling loop
  scheduler.ts                  # Polls chain for overdue subscriptions and calls charge()
  logger.ts                     # Structured logging — no console.log in production paths
/test
  SubscriptionManager.t.sol     # Foundry tests for all contract logic
/src
  /demo                         # Minimal frontend demo (single HTML file or React SPA)
  /constants
    addresses.ts                # Contract and token addresses loaded from env
    abis.ts                     # Contract ABIs
  /services
    contractService.ts          # All contract interaction functions — no raw ethers calls outside here
  /utils
    formatting.ts               # USDC amount formatting helpers (6 decimal conversions)
.env                            # Never committed
.env.example                    # Committed — all keys listed, values blank
foundry.toml                    # Foundry configuration
```

---

## Core Principles

These apply to every line of code written in this project:

1. Write it right the first time. Do not produce code that needs cleanup immediately after.
2. Do exactly what was asked. Nothing more, nothing less.
3. If a task is ambiguous, ask one clarifying question before writing any code.
4. If a fix introduces risk to unrelated code, stop and flag it before proceeding.
5. Every task is considered incomplete until all items in the Definition of Done pass.

---

## Naming Conventions

### Solidity (EVM)

- Contracts and interfaces: `PascalCase`
- Functions and variables: `camelCase`
- Constants and immutables: `UPPER_SNAKE_CASE`
- Private state variables: prefix with underscore (`_variableName`)
- Events: `PascalCase`, past tense (`SubscriptionCreated`, `PaymentCharged`, `SubscriptionCancelled`)
- Custom errors: `PascalCase` descriptive noun phrases (`InsufficientAllowance`, `PlanNotFound`, `AlreadySubscribed`, `PaymentNotDue`)

### TypeScript (scripts, keeper, frontend)

- Variables and functions: `camelCase`
- Constants and enums: `UPPER_SNAKE_CASE`
- Files: `camelCase.ts`
- Test files: mirror the source file with `.test.ts` suffix
- Environment variables: `UPPER_SNAKE_CASE` with descriptive prefix (`ARC_RPC_URL`, `USDC_ADDRESS`, `CONTRACT_ADDRESS`, `KEEPER_PRIVATE_KEY`)

---

## Code Quality Rules

### Functions

- One function does one thing. If it needs a comment to explain what it does across multiple concerns, split it.
- Maximum function length: 40 lines. Extract logic into helpers if exceeded.
- Maximum file length: 300 lines. Split into focused modules if exceeded.
- No functions with more than 4 parameters. Use an options object or struct if more are needed.
- TypeScript functions must have explicit return types.

### Variables

- No single-letter variable names except short loop counters (`i`, `j`).
- Names must describe what the value is: `planPrice`, `subscriberAddress`, `nextChargeTimestamp` — not `data`, `val`, `temp`.
- No abbreviations unless industry-standard (`id`, `addr`, `tx`, `ctx`).

### DRY

- Before writing any logic, check the codebase for existing implementations.
- Logic used in more than one place must be extracted into a shared utility, service, or library.
- Any value that appears more than once must be a named constant.
- No copy-pasted blocks. Extract first.

### Dead Code

- Never leave commented-out code. Delete it.
- Never leave unused variables, imports, or functions. Delete them.
- Never leave `TODO` comments without a GitHub issue number.

---

## Error Handling Rules

### Solidity

- Use custom errors instead of `require` with string messages:

```solidity
// Wrong
require(plan.price > 0, "Plan does not exist");

// Correct
if (plan.price == 0) revert PlanNotFound(planId);
```

- Every external call must check the return value. For USDC `transferFrom`, revert if it returns false:

```solidity
bool success = IUSDC(usdcAddress).transferFrom(subscriber, merchant, plan.price);
if (!success) revert TransferFailed(subscriber, plan.price);
```

- Use checks-effects-interactions on every function that modifies state and transfers USDC.
- Custom errors must include the relevant state values as parameters for debuggability.

### TypeScript

- Every `async` function must be wrapped in `try/catch`.
- Never catch an error silently. At minimum, log it through the logger.
- All thrown errors must be instances of a proper Error class, never plain strings.
- The keeper bot must not crash on a single failed charge. Catch per-subscription errors and continue the loop.

---

## Security Rules

### Solidity

- Follow checks-effects-interactions on every state-modifying function.
- Mark all internal functions as `internal` or `private`.
- Use `nonReentrant` modifier from OpenZeppelin on `charge()` and any function that transfers USDC.
- Never use `tx.origin` for authorization. Always use `msg.sender`.
- Use OpenZeppelin's `Ownable` or `AccessControl` for any admin functions.
- Audit every arithmetic operation for overflow — use Solidity 0.8+ built-in overflow protection.
- The `charge()` function must verify `block.timestamp >= subscription.nextChargeTimestamp` before transferring funds. Never trust keeper-supplied timestamps.

### TypeScript

- No private keys in source code. Load from `KEEPER_PRIVATE_KEY` env variable only.
- `.env` must be in `.gitignore` before the first commit.
- Validate that all required env variables are present at process startup. Fail fast with a clear error if any are missing.
- Never log private keys, raw transaction data, or wallet balances at a level that persists to files.

---

## Performance Rules

### Solidity

- Minimize storage reads and writes — they are the most expensive operations.
- Use `calldata` instead of `memory` for read-only function parameters.
- Pack storage variables to fit within 32-byte slots where possible.
- Use events to record subscription history. Do not store historical payment records in arrays on-chain.

### TypeScript (Keeper)

- The keeper must batch RPC calls where possible. Do not make one RPC call per subscription in a tight loop.
- Use `Promise.all` for independent async operations.
- Add jitter to the polling interval to avoid thundering herd on the RPC endpoint.

---

## Testing Rules

- Write tests for every critical path before marking a task complete.
- Cover both success and failure scenarios for every tested function.
- Test edge cases: zero price, zero interval, subscriber with no allowance, double-charge attempt, cancelled subscription.
- Foundry tests must use `MockUSDC.sol` — never use the real testnet USDC in unit tests.
- Unit tests must not make real network calls.

### Minimum coverage

- `charge()` function: all success and revert paths
- `subscribe()` function: all success and revert paths
- `createPlan()` and `cancelSubscription()`: all paths
- Keeper bot scheduler logic: unit test with mocked contract calls

---

## Comments and Documentation

- Do not write comments that describe what the code does. Write comments that explain why a decision was made.
- Every exported Solidity function must have a NatSpec comment (`@notice`, `@param`, `@return`).
- Every exported TypeScript function must have a JSDoc comment.
- Every API or script entry point must have a comment block describing its purpose, inputs, and expected outputs.
- Keep comments accurate. If code changes, update the comment immediately.

---

## Environment Variables

All required keys. Values go in `.env` (never committed). This list goes in `.env.example` with blank values:

```
ARC_RPC_URL=
USDC_ADDRESS=
CONTRACT_ADDRESS=
DEPLOYER_PRIVATE_KEY=
KEEPER_PRIVATE_KEY=
CHAIN_ID=5042002
KEEPER_POLL_INTERVAL_MS=
```

---

## Git and Commits

- Each commit does one thing. Do not mix contract changes, script changes, and keeper changes in one commit.
- Commit message format: `type(scope): short description`
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
  - Scopes for this project: `contracts`, `keeper`, `scripts`, `demo`, `config`
  - Example: `feat(contracts): add charge() with reentrancy guard`
- Never commit directly to `main`. Always use a branch.
- Branch naming: `type/short-description`

---

## Definition of Done

A task is only complete when every item on this list passes:

- [ ] The code does exactly what was asked
- [ ] No unused variables, imports, or functions
- [ ] No commented-out code
- [ ] No hardcoded secrets, addresses, or magic values — everything is in constants or env vars
- [ ] All async TypeScript functions have error handling
- [ ] All user inputs and on-chain inputs are validated before use
- [ ] No logic is duplicated — shared logic is extracted
- [ ] Tests are written for critical paths and edge cases
- [ ] All exported functions have documentation comments
- [ ] No `console.log` statements in production code paths — use the logger
- [ ] `.env.example` is updated if new environment variables were added
- [ ] No new lint errors or warnings introduced
- [ ] USDC amounts are handled in 6-decimal units consistently

---

## What Claude Code Must Never Do

- Never leave a task half-done and ask the user to finish it without flagging why
- Never refactor code outside the current task scope
- Never rename variables, restructure folders, or change logic outside the task
- Never install a new dependency without stating the package name and reason first
- Never make a breaking change without flagging it explicitly before proceeding
- Never write `any` as a TypeScript type unless absolutely unavoidable — always explain why
- Never use `console.log` for logging in production code — use `logger.ts`
- Never push placeholder or stub implementations without marking them `// STUB:` with a reason
- Never assume USDC uses 18 decimals. It uses 6. Always.
- Never hardcode the RPC URL, USDC address, or contract address anywhere in source code
- Never write a payable function or reference ETH/msg.value for billing logic — Arc uses USDC as gas
- Never use an oracle for price conversion — amounts are already in USDC
