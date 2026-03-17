import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

/**
 * Guard that validates GitHub webhook HMAC-SHA256 signatures.
 * Uses timing-safe comparison to prevent timing attacks.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET', '');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-hub-signature-256'] as
      | string
      | undefined;

    if (!signature) {
      this.logger.warn(`Webhook request missing signature from ${request.ip}`);
      throw new UnauthorizedException('Missing webhook signature');
    }

    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      this.logger.error(
        'Raw body not available — bodyParser must preserve raw body',
      );
      throw new UnauthorizedException('Cannot validate signature');
    }

    const expected =
      'sha256=' +
      crypto.createHmac('sha256', this.secret).update(rawBody).digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      this.logger.warn(`Invalid webhook signature from ${request.ip}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
