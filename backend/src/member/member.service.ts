import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Stripe = require('stripe');

import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.service';

type WalletRow = {
  user_id: string;
  points_balance: number;
  lifetime_points: number;
  updated_at: Date;
};

type BankAccountRow = {
  id: string;
  user_id: string;
  bank_name: string;
  account_name: string;
  account_number_last4: string;
  created_at: Date;
};

type RechargeRow = {
  id: string;
  user_id: string;
  bank_account_id: string | null;
  amount_cents: number;
  points: number;
  payment_provider: PaymentProvider;
  status: RechargeStatus;
  transfer_reference: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: Date;
  confirmed_at: Date | null;
};

type TransactionRow = {
  id: string;
  points_delta: number;
  balance_after: number;
  reason: string;
  created_at: Date;
};

type RechargeStatus = 'pending' | 'confirmed' | 'cancelled';
type PaymentProvider = 'bank_transfer' | 'stripe_checkout';

type AddBankAccountInput = {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
};

type CreateRechargeInput = AddBankAccountInput & {
  bankAccountId?: string;
  amount?: number;
  transferReference?: string;
};

type NormalizedBankAccount = {
  bankName: string;
  accountName: string;
  accountNumberLast4: string;
};

type PointCharge = {
  userId: string;
  wallet: ReturnType<typeof toWallet>;
  transaction: ReturnType<typeof toTransaction>;
};

@Injectable()
export class MemberService {
  private stripe: Stripe.Stripe | undefined;

  constructor(
    private readonly authService: AuthService,
    private readonly database: DatabaseService,
  ) {}

  async getWallet(token: string | undefined) {
    const user = await this.requireCustomerUser(token);
    const [wallet, bankAccounts, recharges, transactions] = await Promise.all([
      this.findOrCreateWallet(user.id),
      this.listBankAccountRows(user.id),
      this.listRechargeRows(user.id),
      this.listTransactionRows(user.id),
    ]);

    return {
      wallet: toWallet(wallet),
      rechargePolicy: {
        currency: 'JPY',
        pointsPerCurrencyUnit: 1,
        confirmationMode: 'manual',
      },
      bankAccounts: bankAccounts.map(toBankAccount),
      recharges: recharges.map(toRecharge),
      transactions: transactions.map(toTransaction),
    };
  }

  async listBankAccounts(token: string | undefined) {
    const user = await this.requireCustomerUser(token);
    const rows = await this.listBankAccountRows(user.id);

    return { bankAccounts: rows.map(toBankAccount) };
  }

  async addBankAccount(
    token: string | undefined,
    input: AddBankAccountInput,
  ) {
    const user = await this.requireCustomerUser(token);
    const bank = normalizeBankAccount(input);

    const result = await this.database.query<BankAccountRow>(
      `
        INSERT INTO member_bank_accounts (
          user_id,
          bank_name,
          account_name,
          account_number_last4
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          user_id,
          bank_name,
          account_name,
          account_number_last4,
          created_at
      `,
      [user.id, bank.bankName, bank.accountName, bank.accountNumberLast4],
    );

    return { bankAccount: toBankAccount(result.rows[0]) };
  }

  async createRecharge(
    token: string | undefined,
    input: CreateRechargeInput,
  ) {
    const user = await this.requireCustomerUser(token);
    const amountCents = normalizeAmountCents(input.amount);
    const points = centsToPoints(amountCents);
    const transferReference = cleanOptional(input.transferReference);
    let bankAccountId = cleanOptional(input.bankAccountId);

    if (bankAccountId) {
      await this.ensureBankAccountOwner(user.id, bankAccountId);
    } else {
      const bank = normalizeBankAccount(input);
      const savedBankAccount = await this.insertBankAccount(user.id, bank);
      bankAccountId = savedBankAccount.id;
    }

    const result = await this.database.query<RechargeRow>(
      `
        INSERT INTO member_recharges (
          user_id,
          bank_account_id,
          amount_cents,
          points,
          transfer_reference
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          user_id,
          bank_account_id,
          amount_cents,
          points,
          payment_provider,
          status,
          transfer_reference,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          created_at,
          confirmed_at
      `,
      [user.id, bankAccountId, amountCents, points, transferReference],
    );

    return { recharge: toRecharge(result.rows[0]) };
  }

  async createStripeCheckout(token: string | undefined, amount: number | undefined) {
    const user = await this.requireCustomerUser(token);
    const amountCents = normalizeAmountCents(amount);
    const points = centsToPoints(amountCents);
    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );

    const rechargeResult = await this.database.query<RechargeRow>(
      `
        INSERT INTO member_recharges (
          user_id,
          amount_cents,
          points,
          payment_provider
        )
        VALUES ($1, $2, $3, 'stripe_checkout')
        RETURNING
          id,
          user_id,
          bank_account_id,
          amount_cents,
          points,
          payment_provider,
          status,
          transfer_reference,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          created_at,
          confirmed_at
      `,
      [user.id, amountCents, points],
    );
    const recharge = rechargeResult.rows[0];

    try {
      const session = await this.stripeClient().checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        success_url: `${frontendUrl}/member?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/member?checkout=cancelled`,
        client_reference_id: recharge.id,
        customer_email: user.email,
        metadata: {
          userId: user.id,
          rechargeId: recharge.id,
          purpose: 'member_points',
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'jpy',
              unit_amount: amountCents,
              product_data: {
                name: 'Member points recharge',
                description: `${points} points`,
              },
            },
          },
        ],
      });

      await this.database.query(
        `
          UPDATE member_recharges
          SET
            stripe_checkout_session_id = $1,
            transfer_reference = $1
          WHERE id = $2
        `,
        [session.id, recharge.id],
      );

      return {
        checkoutUrl: session.url,
        checkoutSessionId: session.id,
        recharge: toRecharge({
          ...recharge,
          stripe_checkout_session_id: session.id,
          transfer_reference: session.id,
        }),
      };
    } catch (error) {
      await this.database.query(
        `
          UPDATE member_recharges
          SET status = 'cancelled'
          WHERE id = $1 AND status = 'pending'
        `,
        [recharge.id],
      );
      throw error;
    }
  }

  async handleStripeWebhook(signature: string | undefined, rawBody: Buffer | undefined) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!rawBody) {
      throw new BadRequestException('Missing Stripe webhook body');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook secret is not configured');
    }

    let event: any;
    try {
      event = this.stripeClient().webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    if (event.type !== 'checkout.session.completed') {
      return { received: true, ignored: true };
    }

    const session = event.data.object;
    const result = await this.fulfillStripeCheckout(session);

    return { received: true, ...result };
  }

  async confirmRecharge(adminApiKey: string | undefined, rechargeId: string) {
    requireAdminApiKey(adminApiKey);
    const cleanRechargeId = normalizeId(rechargeId, 'Recharge id');

    const existingRecharge = await this.findRecharge(cleanRechargeId);
    if (!existingRecharge) {
      throw new NotFoundException('Pending recharge was not found');
    }

    if (existingRecharge.payment_provider === 'stripe_checkout') {
      throw new BadRequestException('Stripe Checkout recharges are confirmed by webhook');
    }

    return this.confirmPendingRecharge(existingRecharge.user_id, cleanRechargeId);
  }

  async chargeAiPreview(
    token: string | undefined,
    points = 10,
  ): Promise<PointCharge> {
    return this.chargeCustomerPoints(token, points, 'ai_preview_generation');
  }

  async chargeBookingPayment(
    token: string | undefined,
    points: number,
  ): Promise<PointCharge> {
    return this.chargeCustomerPoints(token, points, 'salon_booking_payment');
  }

  async refundAiPreview(userId: string, points = 10) {
    const cost = normalizePointCost(points);

    const walletResult = await this.database.query<WalletRow>(
      `
        UPDATE member_wallets
        SET
          points_balance = points_balance + $2,
          updated_at = now()
        WHERE user_id = $1
        RETURNING user_id, points_balance, lifetime_points, updated_at
      `,
      [userId, cost],
    );

    const wallet = walletResult.rows[0];
    if (!wallet) {
      return null;
    }

    const transactionResult = await this.database.query<TransactionRow>(
      `
        INSERT INTO member_point_transactions (
          user_id,
          recharge_id,
          points_delta,
          balance_after,
          reason
        )
        VALUES ($1, NULL, $2, $3, $4)
        RETURNING id, points_delta, balance_after, reason, created_at
      `,
      [userId, cost, wallet.points_balance, 'ai_preview_refund'],
    );

    return {
      wallet: toWallet(wallet),
      transaction: toTransaction(transactionResult.rows[0]),
    };
  }

  private async fulfillStripeCheckout(session: any) {
    if (session.payment_status !== 'paid') {
      return { fulfilled: false, reason: 'payment_not_paid' };
    }

    const rechargeId = session.metadata?.rechargeId ?? session.client_reference_id ?? undefined;
    const cleanRechargeId = normalizeId(rechargeId, 'Recharge id');
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    const recharge = await this.findRecharge(cleanRechargeId);
    if (!recharge) {
      throw new NotFoundException('Stripe recharge was not found');
    }

    if (recharge.payment_provider !== 'stripe_checkout') {
      throw new BadRequestException('Recharge is not a Stripe Checkout recharge');
    }

    if (recharge.status === 'confirmed') {
      return { fulfilled: true, alreadyProcessed: true };
    }

    if (recharge.stripe_checkout_session_id && recharge.stripe_checkout_session_id !== session.id) {
      throw new BadRequestException('Stripe checkout session does not match recharge');
    }

    if ((session.amount_total ?? 0) !== Number(recharge.amount_cents)) {
      throw new BadRequestException('Stripe checkout amount does not match recharge');
    }

    if (session.currency?.toLowerCase() !== 'jpy') {
      throw new BadRequestException('Stripe checkout currency does not match recharge');
    }

    await this.database.query(
      `
        UPDATE member_recharges
        SET
          stripe_checkout_session_id = $1,
          stripe_payment_intent_id = $2,
          transfer_reference = $1
        WHERE id = $3
      `,
      [session.id, paymentIntentId, recharge.id],
    );

    const confirmed = await this.confirmPendingRecharge(recharge.user_id, recharge.id);

    return { fulfilled: true, ...confirmed };
  }

  private async confirmPendingRecharge(userId: string, rechargeId: string) {
    const rechargeResult = await this.database.query<RechargeRow>(
      `
        UPDATE member_recharges
        SET status = 'confirmed', confirmed_at = now()
        WHERE id = $1 AND user_id = $2 AND status = 'pending'
        RETURNING
          id,
          user_id,
          bank_account_id,
          amount_cents,
          points,
          payment_provider,
          status,
          transfer_reference,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          created_at,
          confirmed_at
      `,
      [rechargeId, userId],
    );

    const recharge = rechargeResult.rows[0];
    if (!recharge) {
      const existingRecharge = await this.findRechargeForUser(userId, rechargeId);
      if (existingRecharge?.status === 'confirmed') {
        const wallet = await this.findOrCreateWallet(userId);

        return {
          wallet: toWallet(wallet),
          recharge: toRecharge(existingRecharge),
          transaction: null,
          alreadyProcessed: true,
        };
      }

      throw new NotFoundException('Pending recharge was not found');
    }

    const walletResult = await this.database.query<WalletRow>(
      `
        INSERT INTO member_wallets (
          user_id,
          points_balance,
          lifetime_points,
          updated_at
        )
        VALUES ($1, $2, $2, now())
        ON CONFLICT (user_id)
        DO UPDATE SET
          points_balance = member_wallets.points_balance + EXCLUDED.points_balance,
          lifetime_points = member_wallets.lifetime_points + EXCLUDED.lifetime_points,
          updated_at = now()
        RETURNING user_id, points_balance, lifetime_points, updated_at
      `,
      [userId, recharge.points],
    );

    const wallet = walletResult.rows[0];
    const transactionResult = await this.database.query<TransactionRow>(
      `
        INSERT INTO member_point_transactions (
          user_id,
          recharge_id,
          points_delta,
          balance_after,
          reason
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, points_delta, balance_after, reason, created_at
      `,
      [
        userId,
        recharge.id,
        recharge.points,
        wallet.points_balance,
        recharge.payment_provider === 'stripe_checkout'
          ? 'stripe_checkout'
          : 'bank_recharge',
      ],
    );

    return {
      wallet: toWallet(wallet),
      recharge: toRecharge(recharge),
      transaction: toTransaction(transactionResult.rows[0]),
    };
  }

  private async requireCustomerUser(token: string | undefined) {
    const user = await this.authService.currentUser(token);
    if (user.role !== 'customer') {
      throw new ForbiddenException('Customer account is required');
    }

    return user;
  }

  private async chargeCustomerPoints(
    token: string | undefined,
    points: number,
    reason: string,
  ): Promise<PointCharge> {
    const user = await this.requireCustomerUser(token);
    const cost = normalizePointCost(points);

    await this.findOrCreateWallet(user.id);

    const walletResult = await this.database.query<WalletRow>(
      `
        UPDATE member_wallets
        SET
          points_balance = points_balance - $2,
          updated_at = now()
        WHERE user_id = $1 AND points_balance >= $2
        RETURNING user_id, points_balance, lifetime_points, updated_at
      `,
      [user.id, cost],
    );

    const wallet = walletResult.rows[0];
    if (!wallet) {
      throw new BadRequestException('Not enough member points');
    }

    const transactionResult = await this.database.query<TransactionRow>(
      `
        INSERT INTO member_point_transactions (
          user_id,
          recharge_id,
          points_delta,
          balance_after,
          reason
        )
        VALUES ($1, NULL, $2, $3, $4)
        RETURNING id, points_delta, balance_after, reason, created_at
      `,
      [user.id, -cost, wallet.points_balance, reason],
    );

    return {
      userId: user.id,
      wallet: toWallet(wallet),
      transaction: toTransaction(transactionResult.rows[0]),
    };
  }

  private async findOrCreateWallet(userId: string): Promise<WalletRow> {
    const result = await this.database.query<WalletRow>(
      `
        INSERT INTO member_wallets (user_id)
        VALUES ($1)
        ON CONFLICT (user_id)
        DO UPDATE SET updated_at = member_wallets.updated_at
        RETURNING user_id, points_balance, lifetime_points, updated_at
      `,
      [userId],
    );

    return result.rows[0];
  }

  private async findRecharge(rechargeId: string): Promise<RechargeRow | undefined> {
    const result = await this.database.query<RechargeRow>(
      `
        SELECT
          id,
          user_id,
          bank_account_id,
          amount_cents,
          points,
          payment_provider,
          status,
          transfer_reference,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          created_at,
          confirmed_at
        FROM member_recharges
        WHERE id = $1
      `,
      [rechargeId],
    );

    return result.rows[0];
  }

  private async findRechargeForUser(
    userId: string,
    rechargeId: string,
  ): Promise<RechargeRow | undefined> {
    const result = await this.database.query<RechargeRow>(
      `
        SELECT
          id,
          user_id,
          bank_account_id,
          amount_cents,
          points,
          payment_provider,
          status,
          transfer_reference,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          created_at,
          confirmed_at
        FROM member_recharges
        WHERE id = $1 AND user_id = $2
      `,
      [rechargeId, userId],
    );

    return result.rows[0];
  }

  private async listBankAccountRows(userId: string): Promise<BankAccountRow[]> {
    const result = await this.database.query<BankAccountRow>(
      `
        SELECT id, user_id, bank_name, account_name, account_number_last4, created_at
        FROM member_bank_accounts
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [userId],
    );

    return result.rows;
  }

  private async insertBankAccount(
    userId: string,
    bank: NormalizedBankAccount,
  ): Promise<BankAccountRow> {
    const result = await this.database.query<BankAccountRow>(
      `
        INSERT INTO member_bank_accounts (
          user_id,
          bank_name,
          account_name,
          account_number_last4
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          user_id,
          bank_name,
          account_name,
          account_number_last4,
          created_at
      `,
      [userId, bank.bankName, bank.accountName, bank.accountNumberLast4],
    );

    return result.rows[0];
  }

  private async listRechargeRows(userId: string): Promise<RechargeRow[]> {
    const result = await this.database.query<RechargeRow>(
      `
        SELECT
          id,
          user_id,
          bank_account_id,
          amount_cents,
          points,
          payment_provider,
          status,
          transfer_reference,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          created_at,
          confirmed_at
        FROM member_recharges
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [userId],
    );

    return result.rows;
  }

  private async listTransactionRows(userId: string): Promise<TransactionRow[]> {
    const result = await this.database.query<TransactionRow>(
      `
        SELECT id, points_delta, balance_after, reason, created_at
        FROM member_point_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [userId],
    );

    return result.rows;
  }

  private async ensureBankAccountOwner(userId: string, bankAccountId: string) {
    const result = await this.database.query<{ id: string }>(
      `
        SELECT id
        FROM member_bank_accounts
        WHERE id = $1 AND user_id = $2
      `,
      [normalizeId(bankAccountId, 'Bank account id'), userId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Bank account was not found');
    }
  }

  private stripeClient(): Stripe.Stripe {
    if (this.stripe) {
      return this.stripe;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException('Stripe secret key is not configured');
    }

    this.stripe = new Stripe(secretKey);
    return this.stripe;
  }
}

function normalizeBankAccount(input: AddBankAccountInput): NormalizedBankAccount {
  const bankName = cleanRequired(input.bankName, 'Bank name');
  const accountName = cleanRequired(input.accountName, 'Account name');
  const accountNumber = cleanRequired(input.accountNumber, 'Account number').replace(
    /\s/g,
    '',
  );

  if (!/^[0-9A-Za-z-]{4,34}$/.test(accountNumber)) {
    throw new BadRequestException('A valid account number is required');
  }

  return {
    bankName,
    accountName,
    accountNumberLast4: accountNumber.slice(-4),
  };
}

function normalizeAmountCents(amount: number | undefined): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new BadRequestException('Recharge amount is required');
  }

  const amountCents = Math.round(amount);
  if (amountCents < 100) {
    throw new BadRequestException('Recharge amount must be at least 100 JPY');
  }

  return amountCents;
}

function normalizePointCost(points: number): number {
  if (!Number.isInteger(points) || points <= 0) {
    throw new BadRequestException('Point cost must be a positive integer');
  }

  return points;
}

function centsToPoints(amountCents: number): number {
  return amountCents;
}

function requireAdminApiKey(value: string | undefined) {
  const expected = process.env.MEMBER_ADMIN_API_KEY;
  if (!expected) {
    throw new ForbiddenException('Member admin API key is not configured');
  }

  if (!value || value !== expected) {
    throw new ForbiddenException('Member admin API key is invalid');
  }
}

function normalizeId(value: string | undefined, label: string): string {
  const clean = cleanRequired(value, label);
  if (!/^\d+$/.test(clean)) {
    throw new BadRequestException(`${label} must be numeric`);
  }

  return clean;
}

function cleanRequired(value: string | undefined, label: string): string {
  const clean = cleanOptional(value);
  if (!clean) {
    throw new BadRequestException(`${label} is required`);
  }

  return clean;
}

function cleanOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toWallet(row: WalletRow) {
  return {
    pointsBalance: Number(row.points_balance),
    lifetimePoints: Number(row.lifetime_points),
    updatedAt: row.updated_at,
  };
}

function toBankAccount(row: BankAccountRow) {
  return {
    id: row.id,
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumberLast4: row.account_number_last4,
    createdAt: row.created_at,
  };
}

function toRecharge(row: RechargeRow) {
  return {
    id: row.id,
    bankAccountId: row.bank_account_id,
    amount: Number(row.amount_cents),
    points: Number(row.points),
    paymentProvider: row.payment_provider,
    status: row.status,
    transferReference: row.transfer_reference,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  };
}

function toTransaction(row: TransactionRow) {
  return {
    id: row.id,
    pointsDelta: Number(row.points_delta),
    balanceAfter: Number(row.balance_after),
    reason: row.reason,
    createdAt: row.created_at,
  };
}
