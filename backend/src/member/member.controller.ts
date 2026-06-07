import { Body, Controller, Get, Headers, Param, Post, RawBody } from '@nestjs/common';

import { MemberService } from './member.service';

type BankAccountBody = {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
};

type RechargeBody = BankAccountBody & {
  bankAccountId?: string;
  amount?: number;
  transferReference?: string;
};

type StripeCheckoutBody = {
  amount?: number;
};

@Controller('member')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get('wallet')
  wallet(@Headers('authorization') authorization?: string) {
    return this.memberService.getWallet(bearerToken(authorization));
  }

  @Get('bank-accounts')
  bankAccounts(@Headers('authorization') authorization?: string) {
    return this.memberService.listBankAccounts(bearerToken(authorization));
  }

  @Post('bank-accounts')
  addBankAccount(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: BankAccountBody,
  ) {
    return this.memberService.addBankAccount(bearerToken(authorization), body);
  }

  @Post('recharges')
  createRecharge(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: RechargeBody,
  ) {
    return this.memberService.createRecharge(bearerToken(authorization), body);
  }

  @Post('stripe/checkout')
  createStripeCheckout(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: StripeCheckoutBody,
  ) {
    return this.memberService.createStripeCheckout(
      bearerToken(authorization),
      body.amount,
    );
  }

  @Post('stripe/webhook')
  stripeWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @RawBody() rawBody: Buffer | undefined,
  ) {
    return this.memberService.handleStripeWebhook(signature, rawBody);
  }

  @Post('recharges/:id/confirm')
  confirmRecharge(
    @Headers('x-member-admin-key') adminApiKey: string | undefined,
    @Param('id') id: string,
  ) {
    return this.memberService.confirmRecharge(adminApiKey, id);
  }
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }

  return authorization.slice('bearer '.length).trim();
}
