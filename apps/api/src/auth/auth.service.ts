import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { Request, Response } from "express";
import { DatabaseService } from "../database.service.js";
import { DEV_USER_ID, ensureDevFixture } from "../dev-fixture.js";
import {
  createCsrfToken,
  hashSessionToken,
  newSessionToken,
  secureStringEqual
} from "./crypto.js";
import { parseCookies, requestIp, SESSION_COOKIE } from "./http.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

type SessionWithUser = NonNullable<
  Awaited<ReturnType<AuthService["findSession"]>>
>;

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  private csrfSecret(): string {
    const secret = process.env.CSRF_SECRET;
    if (!secret) throw new Error("CSRF_SECRET is required");
    return secret;
  }

  private devLoginSecret(): string {
    const secret = process.env.DEV_LOGIN_SECRET;
    if (!secret) throw new Error("DEV_LOGIN_SECRET is required when DEV login is enabled");
    return secret;
  }

  assertDevLoginAllowed(req: Request): void {
    if (process.env.APP_STAGE === "prod") {
      throw new NotFoundException();
    }

    if (process.env.DEV_LOGIN_ENABLED !== "true") {
      throw new NotFoundException();
    }

    const supplied = req.header("x-dev-login-secret") ?? "";
    if (!secureStringEqual(supplied, this.devLoginSecret())) {
      throw new ForbiddenException("DEV_LOGIN_FORBIDDEN");
    }
  }

  async createDevSession(req: Request, res: Response): Promise<void> {
    this.assertDevLoginAllowed(req);
    await ensureDevFixture(this.db.client);

    const token = newSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.db.client.userSession.create({
      data: {
        tokenHash,
        userId: DEV_USER_ID,
        expiresAt,
        ip: requestIp(req),
        userAgent: req.header("user-agent")
      }
    });

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS
    });
  }

  async findSession(req: Request) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return null;

    return this.db.client.userSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true }
    });
  }

  async requireSession(req: Request): Promise<SessionWithUser> {
    const session = await this.findSession(req);
    const now = new Date();

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException("AUTH_REQUIRED");
    }

    return session as SessionWithUser;
  }

  async csrfToken(req: Request): Promise<string> {
    const session = await this.requireSession(req);
    return createCsrfToken(
      this.csrfSecret(),
      session.id,
      session.csrfVersion
    );
  }

  async requireCsrf(req: Request): Promise<SessionWithUser> {
    const session = await this.requireSession(req);
    const supplied = req.header("x-csrf-token") ?? "";
    const expected = createCsrfToken(
      this.csrfSecret(),
      session.id,
      session.csrfVersion
    );

    if (!secureStringEqual(supplied, expected)) {
      throw new ForbiddenException("CSRF_INVALID");
    }

    return session;
  }

  async logout(req: Request, res: Response): Promise<void> {
    const session = await this.requireCsrf(req);

    await this.db.client.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });

    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/"
    });
  }
}
