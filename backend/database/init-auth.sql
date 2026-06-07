CREATE DATABASE ai_hairstyle;

\connect ai_hairstyle

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  email_verification_required BOOLEAN NOT NULL DEFAULT false,
  email_verification_token_hash TEXT,
  email_verification_expires_at TIMESTAMPTZ,
  password_reset_token_hash TEXT,
  password_reset_code_hash TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  password_reset_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_role_idx
ON users (email, role);

CREATE TABLE IF NOT EXISTS member_wallets (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_bank_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number_last4 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_recharges (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_account_id BIGINT REFERENCES member_bank_accounts(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  points INTEGER NOT NULL CHECK (points > 0),
  payment_provider TEXT NOT NULL DEFAULT 'bank_transfer',
  status TEXT NOT NULL DEFAULT 'pending',
  transfer_reference TEXT,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS member_recharges_stripe_session_idx
ON member_recharges (stripe_checkout_session_id)
WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS member_point_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recharge_id BIGINT REFERENCES member_recharges(id) ON DELETE SET NULL,
  points_delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
