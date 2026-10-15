-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING');

-- CreateTable
CREATE TABLE "shipping_options" (
    "id" SERIAL NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "min_days" INTEGER NOT NULL,
    "max_days" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shipping_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "VoucherType" NOT NULL,
    "value" INTEGER NOT NULL,
    "max_discount" INTEGER,
    "min_spend" INTEGER NOT NULL DEFAULT 0,
    "shop_id" INTEGER,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_options_channel_id_name_key" ON "shipping_options"("channel_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE INDEX "vouchers_shop_id_idx" ON "vouchers"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- AddForeignKey
ALTER TABLE "shipping_options" ADD CONSTRAINT "shipping_options_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "shipping_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rules Prisma cannot express in schema.prisma.
ALTER TABLE "shipping_options" ADD CONSTRAINT "shipping_options_price_not_negative" CHECK ("price" >= 0);
ALTER TABLE "shipping_options" ADD CONSTRAINT "shipping_options_days_valid" CHECK ("min_days" >= 0 AND "max_days" >= "min_days");

ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_value_positive" CHECK ("value" > 0);
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_percent_up_to_100" CHECK ("type" <> 'PERCENT' OR "value" <= 100);
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_max_discount_positive" CHECK ("max_discount" IS NULL OR "max_discount" > 0);
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_min_spend_not_negative" CHECK ("min_spend" >= 0);
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_dates_in_order" CHECK ("ends_at" > "starts_at");
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_usage_valid" CHECK ("used_count" >= 0 AND ("usage_limit" IS NULL OR ("usage_limit" > 0 AND "used_count" <= "usage_limit")));
