import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, createHash, pbkdf2Sync, randomBytes, randomInt, timingSafeEqual } from 'crypto';

import { DatabaseService } from '../database/database.service';
import { EmailService } from './email.service';

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  password_hash: string;
  email_verified_at: Date | null;
  email_verification_required: boolean;
  password_reset_requested_at: Date | null;
  created_at: Date;
};

export type UserRole = 'customer' | 'salon' | 'stylist';

type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  emailVerified: boolean;
  createdAt: Date;
};

type AuthPayload = {
  token: string;
  user: PublicUser;
};

type RegisterPayload = {
  emailVerificationRequired: true;
  email: string;
  role: UserRole;
};

type ResetPasswordInput = {
  token?: string;
  email?: string;
  role?: string;
  code?: string;
  newPassword?: string;
};

@Injectable()
export class AuthService {
  private readonly tokenSecret = authTokenSecret();

  constructor(
    private readonly database: DatabaseService,
    private readonly emailService: EmailService,
  ) {}

  async register(
    email: string,
    password: string,
    name?: string,
    role?: string,
  ): Promise<RegisterPayload> {
    const normalizedEmail = normalizeEmail(email);
    validatePassword(password);
    const userRole = normalizeRole(role);
    const verificationToken = randomBytes(32).toString('base64url');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      const result = await this.database.query<UserRow>(
        `
          INSERT INTO users (
            email,
            name,
            role,
            password_hash,
            email_verification_required,
            email_verification_token_hash,
            email_verification_expires_at
          )
          VALUES ($1, $2, $3, $4, true, $5, $6)
          RETURNING
            id,
            email,
            name,
            role,
            password_hash,
            email_verified_at,
            email_verification_required,
            created_at
        `,
        [
          normalizedEmail,
          cleanName(name),
          userRole,
          hashPassword(password),
          hashToken(verificationToken),
          verificationExpiresAt,
        ],
      );

      await this.emailService.sendVerificationEmail({
        to: normalizedEmail,
        name: result.rows[0].name,
        confirmUrl: buildEmailConfirmUrl(verificationToken),
      });

      return {
        emailVerificationRequired: true,
        email: normalizedEmail,
        role: userRole,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existingUser = await this.findByEmail(normalizedEmail, userRole);
        if (existingUser?.email_verification_required && !existingUser.email_verified_at) {
          return this.refreshVerification(existingUser);
        }

        throw new BadRequestException('This email is already registered');
      }

      throw error;
    }
  }

  async resendConfirmation(
    email: string,
    role?: string,
  ): Promise<RegisterPayload> {
    const normalizedEmail = normalizeEmail(email);
    const userRole = normalizeRole(role);
    const user = await this.findByEmail(normalizedEmail, userRole);

    if (!user) {
      throw new BadRequestException('No pending account was found for this email');
    }

    if (!user.email_verification_required || user.email_verified_at) {
      throw new BadRequestException('This email has already been confirmed');
    }

    return this.refreshVerification(user);
  }

  async requestPasswordReset(
    email: string,
    role?: string,
  ): Promise<{ resetRequested: true }> {
    const normalizedEmail = normalizeEmail(email);
    const userRole = normalizeRole(role);
    const user = await this.findByEmail(normalizedEmail, userRole);

    if (!user) {
      return { resetRequested: true };
    }

    const lastRequestAt = user.password_reset_requested_at?.getTime() ?? 0;
    if (Date.now() - lastRequestAt < 60_000) {
      return { resetRequested: true };
    }

    const resetToken = randomBytes(32).toString('base64url');
    const resetCode = String(randomInt(100000, 1000000));
    const resetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.database.query(
      `
        UPDATE users
        SET
          password_reset_token_hash = $1,
          password_reset_code_hash = $2,
          password_reset_expires_at = $3,
          password_reset_requested_at = now()
        WHERE id = $4
      `,
      [
        hashToken(resetToken),
        hashToken(resetCode),
        resetExpiresAt,
        user.id,
      ],
    );

    await this.emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: buildPasswordResetUrl(resetToken),
      code: resetCode,
    });

    return { resetRequested: true };
  }

  async login(
    email: string,
    password: string,
    role?: string,
  ): Promise<AuthPayload> {
    const expectedRole = normalizeRole(role);
    const user = await this.findByEmail(normalizeEmail(email), expectedRole);

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.email_verification_required && !user.email_verified_at) {
      throw new UnauthorizedException('Please confirm your email before logging in');
    }

    return this.authPayload(user);
  }

  async confirmEmail(token: string): Promise<{ confirmed: true }> {
    if (!token) {
      throw new BadRequestException('Email confirmation token is required');
    }

    const result = await this.database.query<UserRow>(
      `
        UPDATE users
        SET
          email_verified_at = now(),
          email_verification_required = false,
          email_verification_token_hash = NULL,
          email_verification_expires_at = NULL
        WHERE
          email_verification_token_hash = $1
          AND email_verification_required = true
          AND email_verification_expires_at > now()
        RETURNING
          id,
          email,
          name,
          role,
          password_hash,
          email_verified_at,
          email_verification_required,
          created_at
      `,
      [hashToken(token)],
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Email confirmation link is invalid or expired');
    }

    return { confirmed: true };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ reset: true }> {
    validatePassword(input.newPassword ?? '');

    if (input.token) {
      const result = await this.database.query<UserRow>(
        `
          UPDATE users
          SET
            password_hash = $1,
            password_reset_token_hash = NULL,
            password_reset_code_hash = NULL,
            password_reset_expires_at = NULL,
            password_reset_requested_at = NULL,
            email_verified_at = COALESCE(email_verified_at, now()),
            email_verification_required = false,
            email_verification_token_hash = NULL,
            email_verification_expires_at = NULL
          WHERE
            password_reset_token_hash = $2
            AND password_reset_expires_at > now()
          RETURNING
            id,
            email,
            name,
            role,
            password_hash,
            email_verified_at,
            email_verification_required,
            password_reset_requested_at,
            created_at
        `,
        [hashPassword(input.newPassword ?? ''), hashToken(input.token)],
      );

      if (!result.rows[0]) {
        throw new BadRequestException('Password reset link or code is invalid or expired');
      }

      return { reset: true };
    }

    const normalizedEmail = normalizeEmail(input.email ?? '');
    const userRole = normalizeRole(input.role);
    const code = normalizeResetCode(input.code ?? '');

    const result = await this.database.query<UserRow>(
      `
        UPDATE users
        SET
          password_hash = $1,
          password_reset_token_hash = NULL,
          password_reset_code_hash = NULL,
          password_reset_expires_at = NULL,
          password_reset_requested_at = NULL,
          email_verified_at = COALESCE(email_verified_at, now()),
          email_verification_required = false,
          email_verification_token_hash = NULL,
          email_verification_expires_at = NULL
        WHERE
          email = $2
          AND role = $3
          AND password_reset_code_hash = $4
          AND password_reset_expires_at > now()
        RETURNING
          id,
          email,
          name,
          role,
          password_hash,
          email_verified_at,
          email_verification_required,
          password_reset_requested_at,
          created_at
      `,
      [
        hashPassword(input.newPassword ?? ''),
        normalizedEmail,
        userRole,
        hashToken(code),
      ],
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Password reset link or code is invalid or expired');
    }

    return { reset: true };
  }

  async currentUser(token: string | undefined): Promise<PublicUser> {
    const payload = this.verifyToken(token);
    const result = await this.database.query<UserRow>(
      `
        SELECT
          id,
          email,
          name,
          role,
          password_hash,
          email_verified_at,
          email_verification_required,
          password_reset_requested_at,
          created_at
        FROM users
        WHERE id = $1
      `,
      [payload.sub],
    );

    const user = result.rows[0];
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return toPublicUser(user);
  }

  async changePassword(
    token: string | undefined,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ user: PublicUser }> {
    validatePassword(newPassword);

    const user = await this.requireCurrentUser(token);
    if (!verifyPassword(currentPassword, user.password_hash)) {
      throw new UnauthorizedException('Invalid current password');
    }

    const result = await this.database.query<UserRow>(
      `
        UPDATE users
        SET password_hash = $1
        WHERE id = $2
        RETURNING
          id,
          email,
          name,
          role,
          password_hash,
          email_verified_at,
          email_verification_required,
          password_reset_requested_at,
          created_at
      `,
      [hashPassword(newPassword), user.id],
    );

    return { user: toPublicUser(result.rows[0]) };
  }

  async changeEmail(
    token: string | undefined,
    newEmail: string,
    currentPassword: string,
  ): Promise<AuthPayload> {
    const user = await this.requireCurrentUser(token);
    const normalizedEmail = normalizeEmail(newEmail);

    if (!verifyPassword(currentPassword, user.password_hash)) {
      throw new UnauthorizedException('Invalid current password');
    }

    try {
      const result = await this.database.query<UserRow>(
        `
          UPDATE users
          SET
            email = $1,
            email_verified_at = COALESCE(email_verified_at, now()),
            email_verification_required = false,
            email_verification_token_hash = NULL,
            email_verification_expires_at = NULL
          WHERE id = $2
          RETURNING
            id,
            email,
            name,
            role,
            password_hash,
            email_verified_at,
            email_verification_required,
            password_reset_requested_at,
            created_at
        `,
        [normalizedEmail, user.id],
      );

      return this.authPayload(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('This email is already registered');
      }

      throw error;
    }
  }

  async createVerifiedUser(
    email: string,
    password: string,
    name: string | undefined,
    role: UserRole,
  ): Promise<PublicUser> {
    const normalizedEmail = normalizeEmail(email);
    validatePassword(password);

    try {
      const result = await this.database.query<UserRow>(
        `
          INSERT INTO users (
            email,
            name,
            role,
            password_hash,
            email_verified_at,
            email_verification_required
          )
          VALUES ($1, $2, $3, $4, now(), false)
          RETURNING
            id,
            email,
            name,
            role,
            password_hash,
            email_verified_at,
            email_verification_required,
            password_reset_requested_at,
            created_at
        `,
        [normalizedEmail, cleanName(name), role, hashPassword(password)],
      );

      return toPublicUser(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('This email is already registered');
      }

      throw error;
    }
  }

  async deleteCurrentUser(
    token: string | undefined,
    password: string,
  ): Promise<{ deleted: true }> {
    const user = await this.requireCurrentUser(token);
    if (!verifyPassword(password, user.password_hash)) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.database.query('DELETE FROM users WHERE id = $1', [user.id]);

    return { deleted: true };
  }

  private async findByEmail(
    email: string,
    role: UserRole,
  ): Promise<UserRow | undefined> {
    const result = await this.database.query<UserRow>(
      `
        SELECT
          id,
          email,
          name,
          role,
          password_hash,
          email_verified_at,
          email_verification_required,
          password_reset_requested_at,
          created_at
        FROM users
        WHERE email = $1 AND role = $2
      `,
      [email, role],
    );

    return result.rows[0];
  }

  private async requireCurrentUser(token: string | undefined): Promise<UserRow> {
    const payload = this.verifyToken(token);
    const result = await this.database.query<UserRow>(
      `
        SELECT
          id,
          email,
          name,
          role,
          password_hash,
          email_verified_at,
          email_verification_required,
          password_reset_requested_at,
          created_at
        FROM users
        WHERE id = $1
      `,
      [payload.sub],
    );

    const user = result.rows[0];
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return user;
  }

  private authPayload(user: UserRow): AuthPayload {
    return {
      token: this.signToken({ sub: user.id, email: user.email, role: user.role }),
      user: toPublicUser(user),
    };
  }

  private async refreshVerification(user: UserRow): Promise<RegisterPayload> {
    const verificationToken = randomBytes(32).toString('base64url');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.database.query(
      `
        UPDATE users
        SET
          email_verification_token_hash = $1,
          email_verification_expires_at = $2
        WHERE id = $3
      `,
      [hashToken(verificationToken), verificationExpiresAt, user.id],
    );

    await this.emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      confirmUrl: buildEmailConfirmUrl(verificationToken),
    });

    return {
      emailVerificationRequired: true,
      email: user.email,
      role: user.role,
    };
  }

  private signToken(payload: Record<string, string>): string {
    const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64Url(
      JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      }),
    );
    const signature = sign(`${header}.${body}`, this.tokenSecret);

    return `${header}.${body}.${signature}`;
  }

  private verifyToken(token: string | undefined): { sub: string; email: string } {
    if (!token) {
      throw new UnauthorizedException('Missing auth token');
    }

    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) {
      throw new UnauthorizedException('Invalid auth token');
    }

    const expected = sign(`${header}.${body}`, this.tokenSecret);
    if (!safeEquals(signature, expected)) {
      throw new UnauthorizedException('Invalid auth token');
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Expired auth token');
    }

    return { sub: String(payload.sub), email: String(payload.email) };
  }
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new BadRequestException('A valid email is required');
  }

  return normalized;
}

function validatePassword(password: string) {
  if (!password || password.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters');
  }
}

function normalizeRole(role: string | undefined): UserRole {
  if (!role || role === 'customer') {
    return 'customer';
  }

  if (role === 'salon') {
    return 'salon';
  }

  if (role === 'stylist') {
    return 'stylist';
  }

  throw new BadRequestException('Invalid user role');
}

function cleanName(name: string | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('base64url');
  const hash = pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString(
    'base64url',
  );

  return `pbkdf2_sha256$${salt}$${hash}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

function buildEmailConfirmUrl(token: string): string {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const url = new URL('/confirm-email', frontendUrl);
  url.searchParams.set('token', token);

  return url.toString();
}

function buildPasswordResetUrl(token: string): string {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const url = new URL('/reset-password', frontendUrl);
  url.searchParams.set('token', token);

  return url.toString();
}

function normalizeResetCode(code: string): string {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) {
    throw new BadRequestException('A valid 6-digit reset code is required');
  }

  return normalized;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, salt, storedHash] = encoded.split('$');
  if (algorithm !== 'pbkdf2_sha256' || !salt || !storedHash) {
    return false;
  }

  const hash = pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString(
    'base64url',
  );

  return safeEquals(hash, storedHash);
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64url');
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function authTokenSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_TOKEN_SECRET must be configured in production');
  }

  return 'dev-only-change-this-auth-secret';
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: Boolean(user.email_verified_at) || !user.email_verification_required,
    createdAt: user.created_at,
  };
}
