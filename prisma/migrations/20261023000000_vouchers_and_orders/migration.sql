-- Checkout vouchers and orders: the draft remembers the chosen voucher, and a placed checkout becomes an order.

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "checkout_drafts" ADD COLUMN     "voucher_id" INTEGER;

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "address_label" TEXT NOT NULL,
    "address_street" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province_name" TEXT NOT NULL,
    "city_name" TEXT NOT NULL,
    "district_name" TEXT NOT NULL,
    "sub_district_name" TEXT NOT NULL,
    "shipping_label" TEXT NOT NULL,
    "shipping_price" INTEGER NOT NULL,
    "shipment_count" INTEGER NOT NULL,
    "payment_method_name" TEXT NOT NULL,
    "voucher_code" TEXT,
    "product_subtotal" INTEGER NOT NULL,
    "shipping_subtotal" INTEGER NOT NULL,
    "buyer_service_fee" INTEGER NOT NULL,
    "handling_fee" INTEGER NOT NULL,
    "damage_protection_fee" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "variant_id" INTEGER,
    "shop_id" INTEGER,
    "shop_name" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "variant_label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- AddForeignKey
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Amounts are integer IDR and never negative; a line has at least one unit.
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_check" CHECK ("product_subtotal" >= 0 AND "shipping_subtotal" >= 0 AND "buyer_service_fee" >= 0 AND "handling_fee" >= 0 AND "damage_protection_fee" >= 0 AND "discount" >= 0 AND "total" >= 0 AND "shipping_price" >= 0 AND "shipment_count" >= 1);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_amounts_check" CHECK ("quantity" >= 1 AND "price" >= 0 AND "line_total" >= 0);
