-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MARIAGE', 'ANNIVERSAIRE', 'ENTREPRISE');

-- CreateEnum
CREATE TYPE "EventState" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED', 'PURGED');

-- CreateEnum
CREATE TYPE "PreviewMode" AS ENUM ('NONE', 'FLASH', 'BLURRED', 'CONFIRM');

-- CreateEnum
CREATE TYPE "Scope" AS ENUM ('NONE', 'EVERYONE', 'SELECTED', 'OWN_ONLY');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('RESERVED', 'UPLOADED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "RequestState" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HOST', 'ADMIN');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "type" "EventType" NOT NULL,
    "eventDate" TIMESTAMPTZ NOT NULL,
    "quotaShots" SMALLINT NOT NULL,
    "closesAt" TIMESTAMPTZ NOT NULL,
    "previewMode" "PreviewMode" NOT NULL DEFAULT 'NONE',
    "color" CHAR(7) NOT NULL,
    "logoKey" TEXT,
    "welcomeMessage" VARCHAR(280),
    "useTableCodes" BOOLEAN NOT NULL DEFAULT false,
    "state" "EventState" NOT NULL DEFAULT 'DRAFT',
    "scope" "Scope" NOT NULL DEFAULT 'NONE',
    "albumToken" TEXT,
    "accessCodeHash" TEXT,
    "photographerToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tables" (
    "id" TEXT NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "qrToken" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "event_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moments" (
    "id" TEXT NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "plannedAt" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "durationMinutes" SMALLINT NOT NULL,
    "bonusShots" SMALLINT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "moments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "state" "PaymentState" NOT NULL DEFAULT 'PENDING',
    "externalRef" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "eventId" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "takenAt" TIMESTAMPTZ NOT NULL,
    "uploadedAt" TIMESTAMPTZ,
    "status" "PhotoStatus" NOT NULL DEFAULT 'RESERVED',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "rollId" TEXT NOT NULL,
    "momentId" TEXT,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rollId" TEXT NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "removal_requests" (
    "id" TEXT NOT NULL,
    "reason" VARCHAR(280) NOT NULL,
    "state" "RequestState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "photoId" TEXT NOT NULL,
    "rollId" TEXT NOT NULL,

    CONSTRAINT "removal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rolls" (
    "id" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "firstName" VARCHAR(30),
    "consentedAt" TIMESTAMPTZ,
    "shotsLeft" SMALLINT NOT NULL,
    "bonusShots" SMALLINT NOT NULL DEFAULT 0,
    "recoveryHash" TEXT,
    "isPhotographer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "tableId" TEXT,

    CONSTRAINT "rolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'HOST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "co_hosts" (
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "co_hosts_pkey" PRIMARY KEY ("userId","eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "events_albumToken_key" ON "events"("albumToken");

-- CreateIndex
CREATE UNIQUE INDEX "events_photographerToken_key" ON "events"("photographerToken");

-- CreateIndex
CREATE INDEX "events_state_closesAt_idx" ON "events"("state", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_tables_qrToken_key" ON "event_tables"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "payments_externalRef_key" ON "payments"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "payments_eventId_key" ON "payments"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "photos_objectKey_key" ON "photos"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "photos_idempotencyKey_key" ON "photos"("idempotencyKey");

-- CreateIndex
CREATE INDEX "photos_rollId_status_idx" ON "photos"("rollId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "rolls_eventId_deviceToken_key" ON "rolls"("eventId", "deviceToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tables" ADD CONSTRAINT "event_tables_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moments" ADD CONSTRAINT "moments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "rolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "moments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "rolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "removal_requests" ADD CONSTRAINT "removal_requests_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "removal_requests" ADD CONSTRAINT "removal_requests_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "rolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rolls" ADD CONSTRAINT "rolls_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rolls" ADD CONSTRAINT "rolls_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "event_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_hosts" ADD CONSTRAINT "co_hosts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_hosts" ADD CONSTRAINT "co_hosts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

