import { loadConfig } from "./config.js";
import { buildGateway } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const gateway = await buildGateway(config);

  await gateway.app.listen({ port: config.port, host: config.host });
  console.log(
    `[gateway] listening on http://localhost:${config.port} ` +
      `(bus: ${config.redisUrl ? "redis" : "in-memory"}, ` +
      `facts: ${gateway.factGenerator?.name ?? "relay"})`,
  );

  if (config.autostart) {
    gateway.replay.start();
    console.log(`[gateway] replay autostarted at ${config.defaultSpeed}x`);
  }

  const shutdown = (): void => {
    void gateway.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
