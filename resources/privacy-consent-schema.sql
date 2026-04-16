CREATE TABLE IF NOT EXISTS portal_privacy_consents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip_address VARCHAR(64) NOT NULL,
    policy_version VARCHAR(32) NOT NULL,
    last_policy_consent_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_privacy_consents_ip_address
    ON portal_privacy_consents (ip_address);

/*
Server-side upsert example:

INSERT INTO portal_privacy_consents (ip_address, policy_version, last_policy_consent_date)
VALUES (:ip_address, :policy_version, :last_policy_consent_date)
ON CONFLICT (ip_address)
DO UPDATE SET
    policy_version = EXCLUDED.policy_version,
    last_policy_consent_date = EXCLUDED.last_policy_consent_date,
    updated_at = CURRENT_TIMESTAMP;
*/
