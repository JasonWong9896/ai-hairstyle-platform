import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://postgres:Aihair-2026-Pg!7vM9q2R@localhost:5432/ai_hairstyle',
  });

  async onModuleInit() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'customer',
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await this.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'
    `);

    await this.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS email_verification_required BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
      ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT,
      ADD COLUMN IF NOT EXISTS password_reset_code_hash TEXT,
      ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMPTZ
    `);

    await this.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key');

    await this.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_role_idx
      ON users (email, role)
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS salon_profiles (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        homepage_url TEXT,
        specialty_images TEXT[] NOT NULL DEFAULT '{}',
        specialty_images_women TEXT[] NOT NULL DEFAULT '{}',
        specialty_images_men TEXT[] NOT NULL DEFAULT '{}',
        intro_images TEXT[] NOT NULL DEFAULT '{}',
        main_intro_image_url TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS salon_hairstyle_details (
        salon_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        price_yen INTEGER NOT NULL DEFAULT 0 CHECK (price_yen >= 0),
        requires_cut BOOLEAN NOT NULL DEFAULT false,
        requires_dye BOOLEAN NOT NULL DEFAULT false,
        requires_treatment BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (salon_id, image_url)
      )
    `);

    await this.query(`
      ALTER TABLE salon_hairstyle_details
      ADD COLUMN IF NOT EXISTS requires_cut BOOLEAN NOT NULL DEFAULT false
    `);

    await this.query(`
      ALTER TABLE salon_profiles
      ADD COLUMN IF NOT EXISTS specialty_images_women TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS specialty_images_men TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS intro_images TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS main_intro_image_url TEXT
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS member_wallets (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
        lifetime_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS member_bank_accounts (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_name TEXT NOT NULL,
        account_name TEXT NOT NULL,
        account_number_last4 TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS member_recharges (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_account_id BIGINT REFERENCES member_bank_accounts(id) ON DELETE SET NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
        points INTEGER NOT NULL CHECK (points > 0),
        payment_provider TEXT NOT NULL DEFAULT 'bank_transfer',
        status TEXT NOT NULL DEFAULT 'pending',
        transfer_reference TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        confirmed_at TIMESTAMPTZ
      )
    `);

    await this.query(`
      ALTER TABLE member_recharges
      ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'bank_transfer',
      ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT
    `);

    await this.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS member_recharges_stripe_session_idx
      ON member_recharges (stripe_checkout_session_id)
      WHERE stripe_checkout_session_id IS NOT NULL
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS member_point_transactions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recharge_id BIGINT REFERENCES member_recharges(id) ON DELETE SET NULL,
        points_delta INTEGER NOT NULL,
        balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS salon_bookings (
        id BIGSERIAL PRIMARY KEY,
        salon_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stylist_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        style_image_url TEXT,
        style_gender TEXT,
        preferred_date DATE NOT NULL,
        preferred_time TIME NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        payment_status TEXT NOT NULL DEFAULT 'not_required',
        payment_amount_yen INTEGER NOT NULL DEFAULT 0 CHECK (payment_amount_yen >= 0),
        stripe_checkout_session_id TEXT,
        stripe_payment_intent_id TEXT,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await this.query(`
      ALTER TABLE salon_bookings
      ADD COLUMN IF NOT EXISTS stylist_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_required',
      ADD COLUMN IF NOT EXISTS payment_amount_yen INTEGER NOT NULL DEFAULT 0 CHECK (payment_amount_yen >= 0),
      ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
      ALTER COLUMN style_image_url DROP NOT NULL,
      ALTER COLUMN style_gender DROP NOT NULL
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS stylist_profiles (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        salon_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_images TEXT[] NOT NULL DEFAULT '{}',
        availability_slots JSONB NOT NULL DEFAULT '[]'::JSONB,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS stylist_profiles_salon_idx
      ON stylist_profiles (salon_id)
    `);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }
}
