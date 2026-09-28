import {
  Controller,
  Get,
  Inject,
  HttpCode,
  Post,
  Req,
  Res
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";

@Controller("api/v1/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get("me")
  async me(@Req() req: Request) {
    const session = await this.auth.requireSession(req);

    return {
      id: session.user.id,
      displayName: session.user.displayName,
      role: session.user.role,
      authProvider: session.user.authProvider
    };
  }

  @Get("csrf")
  async csrf(@Req() req: Request) {
    return { csrfToken: await this.auth.csrfToken(req) };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<void> {
    await this.auth.logout(req, res);
  }
}
