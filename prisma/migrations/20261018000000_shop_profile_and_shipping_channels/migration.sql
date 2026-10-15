-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "city_id" INTEGER,
ADD COLUMN     "closing_time" TEXT,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "district_id" INTEGER,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "opening_time" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "province_id" INTEGER,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "sub_district_id" INTEGER,
ADD COLUMN     "zip_code" TEXT;

-- CreateTable
CREATE TABLE "shipping_channels" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "shipping_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_shipping_channels" (
    "shop_id" INTEGER NOT NULL,
    "shipping_channel_id" INTEGER NOT NULL,

    CONSTRAINT "shop_shipping_channels_pkey" PRIMARY KEY ("shop_id","shipping_channel_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_channels_name_key" ON "shipping_channels"("name");

-- CreateIndex
CREATE UNIQUE INDEX "shops_owner_id_key" ON "shops"("owner_id");

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_sub_district_id_fkey" FOREIGN KEY ("sub_district_id") REFERENCES "sub_districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_shipping_channels" ADD CONSTRAINT "shop_shipping_channels_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_shipping_channels" ADD CONSTRAINT "shop_shipping_channels_shipping_channel_id_fkey" FOREIGN KEY ("shipping_channel_id") REFERENCES "shipping_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Shop names are unique ignoring letter case. Prisma cannot express a functional index in
-- schema.prisma, so it only exists here. (It fails to build if two existing shops already
-- have names that differ only in case.)
CREATE UNIQUE INDEX "shops_name_lower_key" ON "shops" (lower("name"));

-- Rules Prisma cannot express in schema.prisma. The service and zod enforce the same rules.
ALTER TABLE "shops" ADD CONSTRAINT "shops_description_length" CHECK (char_length("description") <= 2000);
ALTER TABLE "shops" ADD CONSTRAINT "shops_phone_format" CHECK ("phone" IS NULL OR "phone" ~ '^\+?[0-9]{8,15}$');
ALTER TABLE "shops" ADD CONSTRAINT "shops_street_length" CHECK ("street" IS NULL OR char_length("street") BETWEEN 1 AND 200);
ALTER TABLE "shops" ADD CONSTRAINT "shops_zip_code_digits" CHECK ("zip_code" IS NULL OR "zip_code" ~ '^[0-9]{5}$');
ALTER TABLE "shops" ADD CONSTRAINT "shops_opening_time_format" CHECK ("opening_time" IS NULL OR "opening_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "shops" ADD CONSTRAINT "shops_closing_time_format" CHECK ("closing_time" IS NULL OR "closing_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
