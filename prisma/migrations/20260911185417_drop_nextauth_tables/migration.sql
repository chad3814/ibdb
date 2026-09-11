-- Drops the NextAuth adapter's tables.
--
-- next-auth and @auth/prisma-adapter were never imported anywhere in src, cli
-- or scripts, and admin access is now a middleware gate over ADMIN_SECRET with
-- a hashed session cookie. The packages were removed in the preceding commit;
-- these are the tables they would have used.
--
-- Safe to drop: the three form a self-contained island, with User referenced
-- only by Account and Session and nothing else in the schema touching them,
-- and all three were verified empty in production before this was written.
-- Irreversible -- restoring them means re-adding the models and migrating.

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "Session";

