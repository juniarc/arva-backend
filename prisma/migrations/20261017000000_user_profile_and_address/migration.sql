-- AlterTable
-- "name" is added as nullable, filled from the username for existing users, then made required.
ALTER TABLE "users" ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photo_url" TEXT;

-- Backfill: existing users start with name equal to their username.
UPDATE "users" SET "name" = "username" WHERE "name" IS NULL;

ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "street" TEXT NOT NULL,
    "sub_district_id" INTEGER NOT NULL,
    "district_id" INTEGER NOT NULL,
    "city_id" INTEGER NOT NULL,
    "province_id" INTEGER NOT NULL,
    "zip_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_addresses_user_id_key" ON "user_addresses"("user_id");

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_sub_district_id_fkey" FOREIGN KEY ("sub_district_id") REFERENCES "sub_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rules Prisma cannot express in schema.prisma. The service and zod enforce the same rules.
ALTER TABLE "users" ADD CONSTRAINT "users_name_length" CHECK (char_length("name") BETWEEN 1 AND 50);
ALTER TABLE "users" ADD CONSTRAINT "users_phone_format" CHECK ("phone" IS NULL OR "phone" ~ '^\+?[0-9]{8,15}$');
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_street_length" CHECK (char_length("street") BETWEEN 1 AND 200);
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_zip_code_digits" CHECK ("zip_code" ~ '^[0-9]{5}$');
