import { defineConfig, loadEnv } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  admin: {
    vite: () => {
      let hmrServer;
      if (process.env.HMR_BIND_HOST) {
        const { createServer } = require("http");
        hmrServer = createServer();
        const hmrPort = parseInt(process.env.HMR_PORT || "9001");
        hmrServer.listen(hmrPort, process.env.HMR_BIND_HOST);
      }

      let allowedHosts;
      if (process.env.__MEDUSA_ADDITIONAL_ALLOWED_HOSTS) {
        allowedHosts = [process.env.__MEDUSA_ADDITIONAL_ALLOWED_HOSTS];
      }

      return {
        server: {
          allowedHosts,
          hmr: {
            server: hmrServer,
          },
        },
      };
    },
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,

    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  modules: [
    // ── SmallTownWeb fork-tilpasning (additivt lag) ──────────────────────────
    // Upstream wirer INGEN redis-moduler → workflow-engine/locking/event-bus/cache
    // bruger in-memory "fake redis". Det HÆNGER `medusa db:migrate` (module-load,
    // ep_poll) i deploy-konteksten. Spejler medusa-templates redis-moduler, BETINGET
    // på REDIS_URL (uændret upstream-adfærd uden creds → ren merge).
    ...(process.env.REDIS_URL
      ? [
          {
            resolve: "@medusajs/medusa/cache-redis",
            options: { redisUrl: process.env.REDIS_URL },
          },
          {
            resolve: "@medusajs/medusa/event-bus-redis",
            options: { redisUrl: process.env.REDIS_URL },
          },
          {
            resolve: "@medusajs/medusa/workflow-engine-redis",
            options: { redis: { url: process.env.REDIS_URL } },
          },
          {
            resolve: "@medusajs/medusa/locking",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/locking-redis",
                  id: "locking-redis",
                  is_default: true,
                  options: { redisUrl: process.env.REDIS_URL },
                },
              ],
            },
          },
        ]
      : []),
    {
      resolve: "@medusajs/medusa/file",
      options: {
        // ── SmallTownWeb fork-tilpasning (additivt lag) ──────────────────────
        // Upstream registrerer s3 UBETINGET (is_default) → backend kan IKKE boote
        // uden R2/S3-creds (s3-iam-role-init crasher på ikke-AWS-hosts som Hetzner).
        // Vi vælger BETINGET: ingen objekt-storage-creds → local file-provider (booter
        // rent); ellers den UÆNDREDE s3-provider nedenfor (verbatim fra upstream → ren
        // merge ved framework-opdateringer).
        // ⚠ PROD-BLOCKER: local-fallback understøtter IKKE kunde-uploads. En rigtig
        // shop KRÆVER en storage-beslutning (R2 per shop / delt). Se automation-spec.
        providers:
          process.env.R2_FILE_URL || process.env.S3_FILE_URL
            ? [
                {
                  id: "s3",
                  resolve: "@medusajs/medusa/file-s3",
                  is_default: true,
                  options: process.env.R2_FILE_URL
                    ? {
                        file_url: process.env.R2_FILE_URL,
                        prefix: process.env.R2_PREFIX,
                        bucket: process.env.R2_BUCKET,
                        endpoint: process.env.R2_ENDPOINT,
                        access_key_id: process.env.R2_ACCESS_KEY_ID,
                        secret_access_key: process.env.R2_SECRET_ACCESS_KEY,
                        session_token: process.env.R2_SESSION_TOKEN,
                        region: "auto",
                        additional_client_config: {
                          forcePathStyle: false,
                          requestChecksumCalculation: "WHEN_REQUIRED",
                        },
                      }
                    : {
                        authentication_method: "s3-iam-role",
                        file_url: process.env.S3_FILE_URL,
                        prefix: process.env.S3_PREFIX,
                        bucket: process.env.S3_BUCKET,
                        endpoint: process.env.S3_ENDPOINT,
                        region: process.env.S3_REGION,
                      },
                },
              ]
            : [
                {
                  id: "local",
                  resolve: "@medusajs/medusa/file-local",
                  is_default: true,
                },
              ],
      },
    },
  ],
});
