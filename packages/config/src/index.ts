import { z } from "zod";

export const PrototypeEnvironment = z.object({
  APP_STAGE: z.enum(["dev", "staging", "prod"]),
  NODE_ENV: z.enum(["development", "test", "production"]),
  DEV_LOGIN_ENABLED: z.enum(["true", "false"]).default("false"),
  DEV_LOGIN_SECRET: z.string().min(24).optional(),
  DATABASE_URL: z.string().min(1),
  GAME_TIMEZONE: z.literal("America/Sao_Paulo"),
  TZ: z.literal("UTC")
}).superRefine((env, ctx) => {
  if (env.APP_STAGE === "prod" && env.DEV_LOGIN_ENABLED === "true") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DEV_LOGIN_ENABLED"],
      message: "DEV login must be disabled in production"
    });
  }
});
