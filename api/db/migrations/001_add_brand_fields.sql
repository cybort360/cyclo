-- Migration 001: add brand identity fields to merchant_profiles
--
-- All four columns are nullable so existing rows are unaffected.
-- Constraints enforce format rules at the DB layer as a second line of
-- defence behind application-level validation in merchants.ts.

ALTER TABLE merchant_profiles
    ADD COLUMN IF NOT EXISTS brand_name        TEXT,
    ADD COLUMN IF NOT EXISTS brand_logo_url    TEXT,
    ADD COLUMN IF NOT EXISTS brand_color       TEXT
        CONSTRAINT merchant_profiles_brand_color_format
            CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9A-Fa-f]{6}$'),
    ADD COLUMN IF NOT EXISTS custom_subdomain  TEXT
        CONSTRAINT merchant_profiles_custom_subdomain_format
            CHECK (
                custom_subdomain IS NULL
                OR (
                    length(custom_subdomain) <= 253
                    AND custom_subdomain ~ '^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
                )
            );
