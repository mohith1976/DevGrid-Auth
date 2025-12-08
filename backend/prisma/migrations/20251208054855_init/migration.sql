/*
  Warnings:

  - You are about to drop the column `githubScope` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "githubScope",
ADD COLUMN     "canReadEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadRepos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadUser" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requestedScopes" TEXT;
