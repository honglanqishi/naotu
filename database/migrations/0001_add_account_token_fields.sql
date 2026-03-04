-- better-auth v1.2+ 要求 accounts 表新增以下字段
-- accessTokenExpiresAt：OAuth access token 的过期时间
-- refreshTokenExpiresAt：OAuth refresh token 的过期时间
-- scope：账号授权范围

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "access_token_expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "refresh_token_expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "scope" text;
