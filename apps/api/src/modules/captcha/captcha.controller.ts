import { Controller, Get } from '@nestjs/common';
import { CaptchaService } from '../../common/captcha/captcha.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
export class CaptchaController {
  constructor(private readonly captcha: CaptchaService) {}

  /** Public: issue a fresh CAPTCHA challenge for a public form to render before submission. */
  @Public()
  @Get('public/captcha')
  challenge() {
    return this.captcha.issueChallenge();
  }
}
