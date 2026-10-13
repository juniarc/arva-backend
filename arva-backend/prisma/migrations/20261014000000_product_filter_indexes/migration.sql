-- Indexes for the product list filters and sorts. No data changes.

-- CreateIndex
CREATE INDEX "shops_city_idx" ON "shops"("city");

-- CreateIndex
CREATE INDEX "products_is_active_sold_count_id_idx" ON "products"("is_active", "sold_count" DESC, "id");

-- CreateIndex
CREATE INDEX "products_is_active_created_at_id_idx" ON "products"("is_active", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "products_is_active_rating_tenths_idx" ON "products"("is_active", "rating_tenths");

-- CreateIndex
CREATE INDEX "product_variants_product_id_price_idx" ON "product_variants"("product_id", "price");
