-- CreateEnum
CREATE TYPE "BattleResult" AS ENUM ('win', 'loss', 'draw');

-- CreateEnum
CREATE TYPE "DeckSide" AS ENUM ('team', 'opponent');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expLevel" INTEGER,
    "trophies" INTEGER NOT NULL DEFAULT 0,
    "bestTrophies" INTEGER NOT NULL DEFAULT 0,
    "arena" TEXT,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "battleCount" INTEGER NOT NULL DEFAULT 0,
    "favouriteCard" TEXT,
    "gold" INTEGER,
    "legendTrophies" INTEGER,
    "clanTag" TEXT,
    "clanName" TEXT,
    "tracked" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSnapshot" (
    "id" TEXT NOT NULL,
    "playerTag" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trophies" INTEGER NOT NULL,
    "bestTrophies" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "battleCount" INTEGER NOT NULL,
    "winRate" DOUBLE PRECISION,
    "arena" TEXT,
    "deck" TEXT[],

    CONSTRAINT "PlayerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clan" (
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "badgeId" INTEGER,
    "type" TEXT,
    "description" TEXT,
    "trophies" INTEGER,
    "requiredTrophies" INTEGER,
    "warTrophies" INTEGER,
    "memberCount" INTEGER,
    "location" TEXT,
    "raw" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clan_pkey" PRIMARY KEY ("tag")
);

-- CreateTable
CREATE TABLE "ClanSnapshot" (
    "id" TEXT NOT NULL,
    "clanTag" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trophies" INTEGER NOT NULL,
    "members" INTEGER,

    CONSTRAINT "ClanSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "battleKey" TEXT NOT NULL,
    "battleTime" TIMESTAMP(3) NOT NULL,
    "playerTag" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "gameMode" TEXT,
    "arena" TEXT,
    "result" "BattleResult" NOT NULL,
    "playerCrowns" INTEGER NOT NULL DEFAULT 0,
    "opponentCrowns" INTEGER NOT NULL DEFAULT 0,
    "opponentTag" TEXT,
    "opponentName" TEXT,
    "playerTrophies" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleDeck" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "side" "DeckSide" NOT NULL,
    "cards" TEXT[],
    "avgElixir" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "archetype" TEXT,

    CONSTRAINT "BattleDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "id" INTEGER,
    "elixir" INTEGER,
    "rarity" TEXT NOT NULL,
    "type" TEXT,
    "arena" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CardSnapshot" (
    "id" TEXT NOT NULL,
    "cardKey" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change" TEXT NOT NULL DEFAULT 'updated',
    "payload" JSONB NOT NULL,

    CONSTRAINT "CardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'global',
    "rank" INTEGER NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trophies" INTEGER NOT NULL,
    "clanName" TEXT,
    "arena" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChestCycle" (
    "id" TEXT NOT NULL,
    "playerTag" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'upcoming',
    "chests" TEXT[],
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChestCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaSnapshot" (
    "id" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "battles" INTEGER NOT NULL,
    "players" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "MetaSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachSession" (
    "id" TEXT NOT NULL,
    "playerTag" TEXT,
    "deck" TEXT[],
    "question" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "answer" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCache" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_tag_key" ON "Player"("tag");

-- CreateIndex
CREATE INDEX "Player_clanTag_idx" ON "Player"("clanTag");

-- CreateIndex
CREATE INDEX "Player_updatedAt_idx" ON "Player"("updatedAt");

-- CreateIndex
CREATE INDEX "PlayerSnapshot_playerTag_capturedAt_idx" ON "PlayerSnapshot"("playerTag", "capturedAt");

-- CreateIndex
CREATE INDEX "ClanSnapshot_clanTag_capturedAt_idx" ON "ClanSnapshot"("clanTag", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Battle_battleKey_key" ON "Battle"("battleKey");

-- CreateIndex
CREATE INDEX "Battle_playerTag_battleTime_idx" ON "Battle"("playerTag", "battleTime");

-- CreateIndex
CREATE INDEX "Battle_battleTime_idx" ON "Battle"("battleTime");

-- CreateIndex
CREATE INDEX "BattleDeck_battleId_idx" ON "BattleDeck"("battleId");

-- CreateIndex
CREATE INDEX "CardSnapshot_cardKey_capturedAt_idx" ON "CardSnapshot"("cardKey", "capturedAt");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_location_capturedAt_idx" ON "LeaderboardEntry"("location", "capturedAt");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_tag_capturedAt_idx" ON "LeaderboardEntry"("tag", "capturedAt");

-- CreateIndex
CREATE INDEX "ChestCycle_playerTag_capturedAt_idx" ON "ChestCycle"("playerTag", "capturedAt");

-- CreateIndex
CREATE INDEX "MetaSnapshot_capturedAt_period_idx" ON "MetaSnapshot"("capturedAt", "period");

-- CreateIndex
CREATE INDEX "CoachSession_playerTag_createdAt_idx" ON "CoachSession"("playerTag", "createdAt");

-- CreateIndex
CREATE INDEX "ApiCache_expiresAt_idx" ON "ApiCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "PlayerSnapshot" ADD CONSTRAINT "PlayerSnapshot_playerTag_fkey" FOREIGN KEY ("playerTag") REFERENCES "Player"("tag") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanSnapshot" ADD CONSTRAINT "ClanSnapshot_clanTag_fkey" FOREIGN KEY ("clanTag") REFERENCES "Clan"("tag") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_playerTag_fkey" FOREIGN KEY ("playerTag") REFERENCES "Player"("tag") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleDeck" ADD CONSTRAINT "BattleDeck_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSnapshot" ADD CONSTRAINT "CardSnapshot_cardKey_fkey" FOREIGN KEY ("cardKey") REFERENCES "Card"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChestCycle" ADD CONSTRAINT "ChestCycle_playerTag_fkey" FOREIGN KEY ("playerTag") REFERENCES "Player"("tag") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachSession" ADD CONSTRAINT "CoachSession_playerTag_fkey" FOREIGN KEY ("playerTag") REFERENCES "Player"("tag") ON DELETE CASCADE ON UPDATE CASCADE;
