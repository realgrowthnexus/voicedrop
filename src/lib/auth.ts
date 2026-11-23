import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { captcha } from "better-auth/plugins/captcha";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { isDisposableEmail } from "@/lib/abuse/disposable";
import { clientIp, hashIp } from "@/lib/abuse/ip";
import { sendEmail, magicLinkEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { track } from "@/lib/events";

export const MAX_ACCOUNTS_PER_IP = 3;
const IP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function headersOf(ctx: unknown): Headers | null {
  const c = ctx as { headers?: Headers; request?: Request } | null;
  return c?.request?.headers ?? c?.headers ?? null;
}

function build() {
  const e = env();
  const plugins = [
    magicLink({
      expiresIn: 15 * 60,
      storeToken: "hashed",
      rateLimit: { window: 300, max: 3 },
      sendMagicLink: async ({ email, url }) => {
        await sendEmail(magicLinkEmail(email, url));
      },
    }),
    ...(e.CAPTCHA_DISABLED
      ? []
      : [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: e.TURNSTILE_SECRET_KEY!,
            endpoints: ["/sign-in/magic-link"],
          }),
        ]),
    nextCookies(), // must be last
  ];

  return betterAuth({
    appName: "VoiceoverDrop",
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.APP_URL],
    database: drizzleAdapter(db(), { provider: "pg", schema: { ...schema, rateLimit: schema.rateLimit } }),
    socialProviders:
      e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET, prompt: "select_account" } }
        : {},
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
    advanced: {
      ipAddress: { ipAddressHeaders: [e.IP_HEADER] },
      useSecureCookies: e.APP_URL.startsWith("https://"),
      database: { generateId: () => crypto.randomUUID() },
    },
    user: {
      additionalFields: {
        banned: { type: "boolean", defaultValue: false, input: false },
        signupIpHash: { type: "string", required: false, input: false },
      },
      validateUserInfo: async ({ user, source }) => {
        if (source.action === "create-user" && typeof user.email === "string" && isDisposableEmail(user.email)) {
          return { error: "disposable_email", errorDescription: "Please use a permanent email address." };
        }
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u, ctx) => {
            const h = headersOf(ctx);
            const ipHash = h ? hashIp(clientIp(h)) : null;
            if (ipHash) {
              const [row] = await db()
                .select({ n: sql<number>`count(*)::int` })
                .from(schema.user)
                .where(and(eq(schema.user.signupIpHash, ipHash), gt(schema.user.createdAt, new Date(Date.now() - IP_WINDOW_MS))));
              if (Number(row?.n ?? 0) >= MAX_ACCOUNTS_PER_IP) {
                throw new APIError("FORBIDDEN", { message: "Too many accounts were created from this network. Please contact support." });
              }
            }
            return { data: { ...u, signupIpHash: ipHash } };
          },
          after: async (u) => {
            await track(u.id, "signup");
          },
        },
      },
      session: {
        create: {
          before: async (s) => {
            const [u] = await db().select({ banned: schema.user.banned }).from(schema.user).where(eq(schema.user.id, s.userId));
            if (u?.banned) throw new APIError("FORBIDDEN", { message: "This account is suspended." });
          },
        },
      },
    },
    plugins,
  });
}

type Auth = ReturnType<typeof build>;
const g = globalThis as unknown as { __vdAuth?: Auth };

export function auth(): Auth {
  if (!g.__vdAuth) g.__vdAuth = build();
  return g.__vdAuth;
}
