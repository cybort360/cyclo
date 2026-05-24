CREATE TABLE IF NOT EXISTS plans (
    plan_id         TEXT PRIMARY KEY,
    merchant        TEXT NOT NULL,
    price           TEXT NOT NULL,
    interval_secs   BIGINT NOT NULL,
    trial_duration  BIGINT NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    plan_id                 TEXT NOT NULL,
    subscriber              TEXT NOT NULL,
    next_charge_timestamp   BIGINT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'active',
    failed_at               BIGINT,
    retry_count             INTEGER NOT NULL DEFAULT 0,
    last_retry              BIGINT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (plan_id, subscriber)
);

CREATE TABLE IF NOT EXISTS execution_logs (
    id              BIGSERIAL PRIMARY KEY,
    tx_hash         TEXT,
    plan_id         TEXT NOT NULL,
    subscriber      TEXT NOT NULL,
    status          TEXT NOT NULL,
    reason_code     INTEGER,
    amount          TEXT,
    error           TEXT,
    block_number    BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS block_history (
    block_number    BIGINT PRIMARY KEY,
    block_hash      TEXT NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS keeper_state (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
    ON subscriptions (status, next_charge_timestamp);

CREATE INDEX IF NOT EXISTS idx_subscriptions_grace
    ON subscriptions (status, last_retry)
    WHERE status = 'past_due';

CREATE INDEX IF NOT EXISTS idx_execution_logs_subscriber
    ON execution_logs (subscriber, plan_id);

CREATE TABLE IF NOT EXISTS merchant_profiles (
    wallet_address  TEXT PRIMARY KEY,
    business_name   TEXT NOT NULL,
    email           TEXT NOT NULL,
    logo_url        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_webhooks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address  TEXT NOT NULL REFERENCES merchant_profiles(wallet_address) ON DELETE CASCADE,
    plan_id         TEXT NOT NULL DEFAULT '*',
    url             TEXT NOT NULL,
    secret          TEXT NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
