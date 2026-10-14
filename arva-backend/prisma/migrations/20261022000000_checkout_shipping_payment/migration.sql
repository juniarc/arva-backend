-- The checkout draft remembers the chosen shipping option and payment method.
ALTER TABLE "checkout_drafts"
  ADD COLUMN "shipping_option_id" INTEGER,
  ADD COLUMN "payment_method_id" INTEGER;

ALTER TABLE "checkout_drafts"
  ADD CONSTRAINT "checkout_drafts_shipping_option_id_fkey" FOREIGN KEY ("shipping_option_id")
    REFERENCES "shipping_options"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "checkout_drafts_payment_method_id_fkey" FOREIGN KEY ("payment_method_id")
    REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The payment methods every shop offers: Mandiri Virtual Account, BCA Virtual Account and QRIS.
-- No payment provider is connected yet. The old placeholder methods are removed (no draft used them:
-- the column above is new).
DELETE FROM "payment_methods" WHERE "code" NOT IN ('MANDIRI_VA', 'BCA_VA', 'QRIS');

INSERT INTO "payment_methods" ("code", "name", "description", "is_enabled", "sort_order") VALUES
  ('MANDIRI_VA', 'Mandiri Virtual Account', 'Pay by transfer to a Mandiri virtual account.', true, 1),
  ('BCA_VA', 'BCA Virtual Account', 'Pay by transfer to a BCA virtual account.', true, 2),
  ('QRIS', 'QRIS', 'Scan the QR code with any QRIS-ready banking or e-wallet app.', true, 3)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "is_enabled" = EXCLUDED."is_enabled",
  "sort_order" = EXCLUDED."sort_order";
