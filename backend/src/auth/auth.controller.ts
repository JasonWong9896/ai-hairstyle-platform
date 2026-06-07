import { Body, Controller, Delete, Get, Headers, Patch, Post } from '@nestjs/common';

import { AuthService } from './auth.service';

type AuthBody = {
  email?: string;
  newEmail?: string;
  token?: string;
  currentPassword?: string;
  newPassword?: string;
  password?: string;
  name?: string;
  role?: string;
  code?: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: AuthBody) {
    return this.authService.register(
      body.email ?? '',
      body.password ?? '',
      body.name,
      body.role,
    );
  }

  @Post('login')
  login(@Body() body: AuthBody) {
    return this.authService.login(body.email ?? '', body.password ?? '', body.role);
  }

  @Post('confirm-email')
  confirmEmail(@Body() body: AuthBody) {
    return this.authService.confirmEmail(body.token ?? '');
  }

  @Post('resend-confirmation')
  resendConfirmation(@Body() body: AuthBody) {
    return this.authService.resendConfirmation(body.email ?? '', body.role);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: AuthBody) {
    return this.authService.requestPasswordReset(body.email ?? '', body.role);
  }

  @Post('reset-password')
  resetPassword(@Body() body: AuthBody) {
    return this.authService.resetPassword({
      token: body.token,
      email: body.email,
      role: body.role,
      code: body.code,
      newPassword: body.newPassword,
    });
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.authService.currentUser(bearerToken(authorization));
  }

  @Patch('password')
  changePassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: AuthBody,
  ) {
    return this.authService.changePassword(
      bearerToken(authorization),
      body.currentPassword ?? '',
      body.newPassword ?? '',
    );
  }

  @Patch('email')
  changeEmail(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: AuthBody,
  ) {
    return this.authService.changeEmail(
      bearerToken(authorization),
      body.newEmail ?? body.email ?? '',
      body.currentPassword ?? '',
    );
  }

  @Delete('me')
  deleteMe(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: AuthBody,
  ) {
    return this.authService.deleteCurrentUser(
      bearerToken(authorization),
      body.password ?? '',
    );
  }
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }

  return authorization.slice('bearer '.length).trim();
}
