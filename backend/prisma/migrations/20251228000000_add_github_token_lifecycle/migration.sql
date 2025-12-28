-- Add columns to support GitHub OAuth token lifecycle
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubAccessTokenExpiresAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubRefreshTokenExpiresAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubTokenValid" BOOLEAN DEFAULT TRUE;
