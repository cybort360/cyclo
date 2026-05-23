-- Migration 002: add display fields required by the past-due merchant API
--
-- All columns are nullable with no default so existing rows are unaffected.
-- The keeper can backfill next_retry_at and failure_reason over time; the API
-- derives both via COALESCE when the columns are NULL.

-- Human-readable plan label shown in merchant-facing UIs.
ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS plan_name TEXT;

-- Unix-seconds timestamp of the next scheduled retry attempt.
-- NULL means the API derives it as last_retry + 86400 (the keeper's 24-hour
-- retry interval defined in RETRY_INTERVAL_MS inside scheduler.ts).
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS next_retry_at BIGINT;

-- Reason the most recent charge attempt failed.
-- Populated by the keeper when marking a subscription past_due or on each retry.
-- The API falls back to execution_logs.reason_code when this column is NULL.
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS failure_reason TEXT
        CONSTRAINT subscriptions_failure_reason_values
            CHECK (
                failure_reason IS NULL
                OR failure_reason IN ('low_balance', 'low_allowance', 'unknown')
            );
