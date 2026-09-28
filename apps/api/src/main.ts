import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule, {
  logger: ["error", "warn", "log"]
});

app.getHttpAdapter().getInstance().disable("x-powered-by");

const port = Number(process.env.PORT ?? 3001);
await app.listen(port, "0.0.0.0");
