-- The fields a seller fills in when listing a product (POST /products).
-- All are optional for the products that already exist.

ALTER TABLE "products"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "discount_percent" INTEGER,
  ADD COLUMN "weight_grams" INTEGER,
  ADD COLUMN "length_cm" INTEGER,
  ADD COLUMN "width_cm" INTEGER,
  ADD COLUMN "height_cm" INTEGER,
  ADD COLUMN "shipping_fee" INTEGER;

ALTER TABLE "products"
  ADD CONSTRAINT "products_discount_percent_check" CHECK ("discount_percent" IS NULL OR "discount_percent" BETWEEN 1 AND 90),
  ADD CONSTRAINT "products_package_check" CHECK (
    ("weight_grams" IS NULL OR "weight_grams" > 0)
    AND ("length_cm" IS NULL OR "length_cm" > 0)
    AND ("width_cm" IS NULL OR "width_cm" > 0)
    AND ("height_cm" IS NULL OR "height_cm" > 0)
  ),
  ADD CONSTRAINT "products_shipping_fee_check" CHECK ("shipping_fee" IS NULL OR "shipping_fee" >= 0);
