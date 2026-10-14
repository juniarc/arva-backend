-- Simulated payment: an order is paid when it is placed, and remembers when.
ALTER TABLE "orders" ADD COLUMN "paid_at" TIMESTAMP(3);

-- Order lines keep the product photo, so the order history still shows it after the product changes.
ALTER TABLE "order_items" ADD COLUMN "image_url" TEXT NOT NULL DEFAULT '';

-- Orders placed before the simulated payment are paid now, and their products count as sold.
UPDATE "products" AS p
SET "sold_count" = p."sold_count" + s.quantity
FROM (
  SELECT oi."product_id", SUM(oi."quantity") AS quantity
  FROM "order_items" oi
  JOIN "orders" o ON o."id" = oi."order_id"
  WHERE o."status" = 'AWAITING_PAYMENT' AND oi."product_id" IS NOT NULL
  GROUP BY oi."product_id"
) AS s
WHERE p."id" = s."product_id";

UPDATE "orders" SET "status" = 'PAID', "paid_at" = "created_at" WHERE "status" = 'AWAITING_PAYMENT';
