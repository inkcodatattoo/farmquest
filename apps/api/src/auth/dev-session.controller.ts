import {
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";

@Controller("api/v1/dev")
export class DevSessionController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("session")
  @HttpCode(204)
  async create(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<void> {
    await this.auth.createDevSession(req, res);
  }
}
