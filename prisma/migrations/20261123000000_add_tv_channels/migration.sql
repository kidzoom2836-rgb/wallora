-- CreateTable
CREATE TABLE "TvChannel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT NOT NULL DEFAULT 'General',
    "logoUrl" TEXT,
    "streamUrl" TEXT NOT NULL,
    "previewUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TvChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvPlaylistSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastChannelCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TvPlaylistSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TvChannel_slug_key" ON "TvChannel"("slug");

-- CreateIndex
CREATE INDEX "TvChannel_status_sortOrder_idx" ON "TvChannel"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "TvChannel_groupName_idx" ON "TvChannel"("groupName");

-- CreateIndex
CREATE INDEX "TvChannel_isFeatured_idx" ON "TvChannel"("isFeatured");

-- CreateIndex
CREATE UNIQUE INDEX "TvPlaylistSource_url_key" ON "TvPlaylistSource"("url");

-- CreateIndex
CREATE INDEX "TvPlaylistSource_enabled_idx" ON "TvPlaylistSource"("enabled");

-- AddForeignKey
ALTER TABLE "TvChannel" ADD CONSTRAINT "TvChannel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

