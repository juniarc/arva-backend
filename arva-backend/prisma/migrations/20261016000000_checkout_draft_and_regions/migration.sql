-- CreateTable
CREATE TABLE "provinces" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" INTEGER NOT NULL,
    "province_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" INTEGER NOT NULL,
    "city_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_districts" (
    "id" INTEGER NOT NULL,
    "district_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "sub_districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_drafts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "address_label" TEXT,
    "address_street" TEXT,
    "recipient_name" TEXT,
    "phone" TEXT,
    "province_id" INTEGER,
    "city_id" INTEGER,
    "district_id" INTEGER,
    "sub_district_id" INTEGER,
    "damage_protection_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_draft_items" (
    "id" SERIAL NOT NULL,
    "draft_id" INTEGER NOT NULL,
    "cart_item_id" INTEGER NOT NULL,

    CONSTRAINT "checkout_draft_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provinces_name_key" ON "provinces"("name");

-- CreateIndex
CREATE INDEX "cities_province_id_idx" ON "cities"("province_id");

-- CreateIndex
CREATE UNIQUE INDEX "cities_province_id_name_key" ON "cities"("province_id", "name");

-- CreateIndex
CREATE INDEX "districts_city_id_idx" ON "districts"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "districts_city_id_name_key" ON "districts"("city_id", "name");

-- CreateIndex
CREATE INDEX "sub_districts_district_id_idx" ON "sub_districts"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "sub_districts_district_id_name_key" ON "sub_districts"("district_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_drafts_user_id_key" ON "checkout_drafts"("user_id");

-- CreateIndex
CREATE INDEX "checkout_draft_items_cart_item_id_idx" ON "checkout_draft_items"("cart_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_draft_items_draft_id_cart_item_id_key" ON "checkout_draft_items"("draft_id", "cart_item_id");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_districts" ADD CONSTRAINT "sub_districts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_sub_district_id_fkey" FOREIGN KEY ("sub_district_id") REFERENCES "sub_districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_draft_items" ADD CONSTRAINT "checkout_draft_items_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "checkout_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_draft_items" ADD CONSTRAINT "checkout_draft_items_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rules Prisma cannot express in schema.prisma. The service and zod enforce the same rules.
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_phone_digits" CHECK ("phone" IS NULL OR "phone" ~ '^[0-9]{8,15}$');
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_address_label_length" CHECK ("address_label" IS NULL OR char_length("address_label") BETWEEN 1 AND 30);
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_address_street_length" CHECK ("address_street" IS NULL OR char_length("address_street") BETWEEN 1 AND 200);
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_recipient_name_length" CHECK ("recipient_name" IS NULL OR char_length("recipient_name") BETWEEN 1 AND 30);
