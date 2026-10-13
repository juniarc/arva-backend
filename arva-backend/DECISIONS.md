# Decisions Log

Record every product, design, or technical decision here. Newest entries go at the top. Each entry has a date, the decision, and the reason.

## 2026-10-13

**CONTRACT CHANGE: `GET /products/:slug` has a new shape.**
It now returns `images`, `variants` (ordered by position), `defaultVariantId`, a `shop` object, `rating { average, ratingCount, reviewCount }`, and `reviewPreview`. The old flat fields (`price`, `originalPrice`, `discountPercent`, `rating` as a number, `city`, `shopName`, `imageUrl`) are no longer in the detail response. The list shape is unchanged except for the new `shopSlug` field.
Reason: the detail page needs the gallery, the shop card, and review data in one request. The frontend should compute the selected price from the chosen variant.

**CONTRACT CHANGE: product list items include `shopSlug`.**
Reason: the frontend links each card to its shop. It is a flat field, matching the existing flat `shopName` and `city`.

**New endpoints: `GET /products/:slug/reviews`, `GET /shops/:slug`, `GET /products/recommended`. New list filters: `shop` and `exclude`.**
`/products/recommended` and `/products/:slug/reviews` reject unknown query keys. `GET /products` still ignores them, so the frontend can add its own parameters.

**Reviews store an author snapshot (`authorName`, `authorAvatarUrl`) and a nullable `userId`.**
Reason: a review keeps its name if the user later changes their username or deletes their account (`userId` becomes null). The API never returns `userId`.

**`ratingCount` and `reviewCount` are stored on products, not counted from the reviews table.**
Reason: review writing is not built yet, and the design shows totals (212 ratings, 104 reviews) that are larger than the sample reviews. Ratings use integer tenths, like products.

**Seeded shop "Shop's Name" (slug `shops-name`, city Jakarta) owns `bali-banana-fruit`.**
The list card and the detail page both show the shop's city, so both now say "Jakarta". This replaces the earlier decision that gave the product "Kab. Badung" through Bali Fresh Farm.

**Seed images: each product has 6 gallery images, and all 6 use the product's real photo for now.**
Reason: only one real photo per product exists, and the frontend has no `/images/dummy/<slug>-n.jpg` files. Replace the urls in the seed when more photos exist. Shop logos and review avatars still use the dummy paths from the design (`/images/dummy/shop-logo-placeholder.jpg`, `/images/dummy/avatar-1.jpg`), which the frontend does not have yet.

## 2026-10-12

**CONTRACT CHANGE: `imageUrl` can be a full URL.**
The backend has an optional `IMAGE_BASE_URL`. When it is set, stored paths like `/images/dummy/x.jpg` are returned as `<IMAGE_BASE_URL>/images/dummy/x.jpg`. A full http(s) URL stored in the database is returned unchanged, so images can later move to a host such as Supabase Storage.
Reason: the frontend should not need to know where images are hosted.

**Backend auth: username uniqueness is case-insensitive through a `username_lower` column.**
`username` keeps the typed casing. A unique index on `username_lower` makes "Alice" and "alice" collide. Prisma cannot declare a unique index on `lower(username)`, and a raw one would show up as drift. Email is stored trimmed and lowercase. Passwords use bcrypt with cost 12.
Reason: simple, enforced by the database, and works with normal Prisma queries.

**CONTRACT CHANGE: `POST /auth/register` 409 includes `field` ("username" or "email"), and `GET /auth/me` was added.**
Reason: the form needs to know which input to mark, and the frontend reads the current user from the token instead of storing the user id.

**Backend auth rate limits: login allows 5 failed attempts per 15 minutes per IP and username. All `/auth` routes allow 300 requests per 15 minutes per IP.**
Reason: slows password guessing. Caveat: the frontend calls the API from its server, so users may share one IP. Configure `trust proxy` and forward the client IP before production.

**Catalog and cart backend: ratings are stored as integer tenths (34 = 3.4).**
Reason: avoids Decimal objects and float rounding.

**Cart checks stock on add but does not reserve it. The cart shows the current variant price, with no price snapshot.**
Reason: matches the earlier decision that stock is checked at checkout. Checkout must snapshot prices into the order. Adds run in a transaction that locks the variant row, so parallel adds cannot pass the stock check together.

**Seeded shops have no owner (`ownerId` is null).**
Reason: sellers and "create shop" are not built yet.

**CONTRACT CHANGE: stock errors on `POST /cart` return `{ message, code }` with code `OUT_OF_STOCK` or `INSUFFICIENT_STOCK`.**
Reason: the frontend needs a stable value to branch on.

**Seed data uses realistic units (for example "1 kg") instead of the design's "500 ml" labels. Bali Fresh Farm's city is "Kab. Badung".**
Reason: the cart needs clear units. The dummy list gave the shop two cities, and the shop model has one. Product 1 now shows Badung, not Bandung. If product 1 must show Bandung, add a city field to products.

**Product price sorting runs in the service layer.**
Reason: Prisma cannot order by the lowest price of a related list. It loads all matching products, which is fine for a small catalog. Revisit if the catalog grows to thousands of products.

**Auth pages follow the Figma design, not the old repo.**
The old repo used email login and had a phone number on sign-up. The Figma design uses username login and has no phone field. We follow Figma.
Reason: Figma is the agreed design. The phone field can be added later if needed.

**Login uses username and password.**
Reason: matches the design ("Enter your username").

**Sign Up has username, email, password, and confirm password.**
Reason: matches the design.

**Routes are /login and /signup.**
Reason: the design says "Sign Up" and the old middleware used /signup. The old /register route is not used.

**Google login and sign-up are UI only.**
Reason: no OAuth backend yet. Buttons show "Coming soon."

**Tokens are stored in httpOnly cookies set by Next.js route handlers.**
Reason: prevents JavaScript from reading the token, which reduces the impact of XSS.

**Frontend uses react-hook-form and zod. Old repo's Formik and Yup are not used.**
Reason: one validation approach shared by client and server.

**Monorepo with apps/web and apps/api. npm workspaces.**
Reason: one repository for both apps, so both devices always have matching versions of the API contract.

**Forgot Password page is a placeholder route.**
Reason: the link appears in the design, but the feature is out of scope for this task.

**Scope is the full marketplace. Auth is the first feature, not the whole project.**
Reason: Arva includes catalog, shops, seller tools, cart, wishlist, checkout, and orders. The full list is in `docs/FEATURES.md`, and features are built in the order given there.

**Three roles: guest, buyer, seller.**
Reason: a seller can also buy. Sellers cannot buy from their own shop.

**One shop per user (provisional).**
Reason: keeps the seller model simple for a bootcamp project. Confirm with the product owner before building create-shop.

**Cart and wishlist require login. Guests can browse only.**
Reason: cart and wishlist are stored per user on the backend. Guest carts are not part of the scope.

**Build order: auth, catalog, seller setup, cart and wishlist, checkout and orders, then reviews, vouchers, and payments.**
Reason: each step depends on the one before it. Payments come last because they need stable orders and stock.

**Cart items do not reserve stock. Stock is checked at checkout.**
Reason: simpler and common in marketplaces. Re-check stock when the order is placed, and reject orders that can't be fulfilled.

## Open questions

- Payments provider (decide after the main features are done).
- Whether the phone number is needed at sign-up.
- Whether login should also accept email.
- Exact font family for headings (confirm in Figma).
- Whether one user can own more than one shop.
- Whether guests can keep a cart before logging in.
- Who creates vouchers: sellers only, the platform only, or both.
- Whether cart is grouped by shop at checkout, or one order per shop.
- How stock is handled for variants that sell out during checkout.

**CONTRACT CHANGE: `GET /cart` adds `product.shop { slug, name }`, keeps `product.shopName`, returns items in a fixed order, and leaves out items of inactive products.**
Reason: the cart page groups items by shop. Order is shop name, product name, product id, variant position, item id. Inactive items are hidden from the items and totals but not deleted, so they return if the product is activated again and the user does not lose a cart line to a temporary change. The user can still remove them with DELETE (they are no longer shown, so this only matters for stale ids).

**CONTRACT CHANGE: new `PATCH /cart/items/:id` and `DELETE /cart/items`.**
Reason: cart page quantity and remove actions. PATCH sets an absolute quantity (1 to 99) and runs in a transaction that locks the variant row, like add. Quantity 0 is a 400, since removing is DELETE. DELETE takes a JSON body, so clients must send `Content-Type: application/json`. It ignores ids that do not belong to the user, so the answer never reveals which ids exist. Stock is still checked per cart and not reserved.

**CONTRACT CHANGE: `GET /products` adds `minPrice`, `maxPrice`, `minRating`, `city` and the sort `relevance`. Its query is now strict: unknown keys return 400 (it was lenient).**
Reason: the products page filters. The frontend sends only known parameters. `popular` now breaks soldCount ties by rating, and the price sorts break ties by id, so pages never repeat or skip a product (`/products/recommended` uses `popular`, so its tie order changes the same way).

**CONTRACT CHANGE: new `GET /products/cities`.**
Reason: fills the city filter. Cached 60 seconds in memory per server instance, so a new city can take up to a minute to appear.

**The lowest-price filters use Prisma relation filters, not a `fromPrice` column or raw SQL.**
Reason: lowest price >= min is the same as "every variant >= min", and lowest price <= max is the same as "some variant <= max". Price sorting still runs in the service (see the earlier decision). Add a `fromPrice` column only when the catalog is large enough to need database sorting by price.

**`relevance` is a placeholder: soldCount, then ratingCount, then id.**
Reason: there is no text search yet. The formula lives in `lib/product-sort.ts` only.

**`city` is an exact, case-sensitive match and an unknown city returns an empty list.**
Reason: city values are stored as typed ("Jakarta", "Kab. B"), and the city list can change. The design shows "DKI Jakarta", but the data says "Jakarta". Not normalized. Decide later whether to change the seed or the design.

**`minRating` is applied to `ratingTenths` (stars x 10). The prompt's `ratingAverage` does not exist as a column.**
Reason: ratings are stored as integer tenths (see the earlier decision). The index is on `(isActive, ratingTenths)`.

**CONTRACT CHANGE: new table `wishlist_items` and new endpoints `GET /wishlist`, `POST /wishlist`, `DELETE /wishlist/items`.**
Reason: wishlist feature. A unique constraint on (userId, productId) makes add idempotent: the service tries the insert and treats a unique violation as "already there", so two parallel adds leave one row. POST and DELETE return the full list so the frontend can replace its state without another request. DELETE ignores ids that do not belong to the user, so the response never reveals which ids exist.

**Wishlist rows hold no price or stock snapshot. The product's current data is read when the list is returned.**
Reason: a wishlist is a bookmark, not an offer. Items of inactive products are hidden from the list and count but not deleted, so they return if the product is activated again. `rating` is a number here, as in the product list (the product detail uses an object).

**CONTRACT CHANGE: new tables for regions, checkout drafts and draft items, and new endpoints `POST /checkout`, `GET /checkout`, `PUT /checkout/address`, and four public `GET /regions/...` lists.**
Reason: first part of checkout. A draft holds references to cart items, not copies, so price, quantity and stock always match the cart. Removing a cart item removes its draft item (cascade). The buyer can still reach the draft from the cart page, and the order task will read the cart again.

**A new draft starts with an empty address.**
Reason: the profile address is not built yet. When it exists, a new draft will copy it.

**Draft creation checks stock and availability but does not reserve stock. It is checked again when the order is placed.**
Reason: same rule as the cart. The draft row is reset with one upsert (so two parallel creates cannot hit the unique user id), and its items are replaced, in one transaction.

**The address is complete only when all eight fields are set, and the draft response returns the whole address or null. The address is written in one UPDATE, so a partial address is never saved by the API.**
Reason: the service decides, with no database trigger. CHECK constraints in the migration also guard the phone (digits, 8 to 15) and the text lengths.

**Region ids come from the seed order, not from the database. Seeded regions are a small development subset.**
Reason: upserting by id keeps the seed repeatable. Only append new entries to the end of the lists in `prisma/data/regions.ts`. The full Indonesian list is loaded later from a data source the project chooses.

**In the draft response `shipping`, `voucher` and `paymentMethod` are always null, and the fee fields and the discount are 0. They are placeholders for the next checkout tasks.**
Reason: the frontend can build against the final shape now.

**CONTRACT CHANGE: users get `name`, `phone` and `photoUrl`; new table `user_addresses`; new endpoints `GET /profile`, `PUT /profile`, `PUT /profile/address`.**
Reason: profile feature. `name` is required in the database. The migration fills it from the username for existing users, and register now saves `name = username` for new users (a change inside the user repository only; the register endpoint and its response are unchanged). Each user has at most one saved address (unique user id, saved with an upsert). `photoUrl` is a nullable column that nothing writes yet.

**Profile username and email use the same uniqueness mechanism as register: the `usernameLower` unique index and the lowercase unique `email`. The profile update checks them and writes in one transaction, and turns a unique-index violation into the same 409.**
Reason: two parallel updates can pass the pre-check, so the database index is the real guard. Username is checked first, so it wins when both are taken.

**Known gap: changing the email takes effect immediately, with no verification step. Existing tokens keep working after a username change because requireAuth identifies the user by id and nothing uses the token's username claim.**

**Phone format: the profile keeps an optional leading "+" (`^\+?[0-9]{8,15}$`), and the checkout address is digits only. The checkout copy step must strip the "+" using `toCheckoutPhone` in `lib/phone.ts`.**
Reason: avoids changing the checkout rule. This is the one place to change if the rule changes (for example "+62812..." to "0812...").

**Planned for the checkout backend (not built): a new draft copies the profile address. The draft needs a label and a recipient name that the profile does not store, so the label defaults to "Home", the recipient name to the profile name, and the phone to the profile phone. If the profile phone is null, checkout must ask for it. The profile address has a zip code that the checkout draft has no column for, so the draft needs one (or drops it) when the copy is built.**

**CONTRACT CHANGE: shops get description, contact, address, opening hours and a unique owner; new tables `shipping_channels` and `shop_shipping_channels`; new endpoints `GET /shops/me`, `PUT /shops/me`, `GET /shops/:slug/products`, `GET /shipping-channels`; `GET /shops/:slug` gains new fields.**
Reason: shop page and owner shop settings. Seeded shops have no owner, so the owner view is tested with a fixture shop only. A shop can have no shipping channel until its owner saves one (the update requires at least one).

**One shop per user is enforced by a unique `ownerId`. This is provisional.**
Reason: the earlier open question. Postgres allows many null owners, so seeded shops without an owner are fine.

**Shop names are unique ignoring letter case, through a functional index on `lower(name)` that only exists in the migration SQL. The update checks the name and also catches the database violation, so two parallel updates cannot both win.**

**The shop slug never changes when the name changes.**
Reason: slugs are URL identifiers, and changing them would break links.

**The shop `city` text is kept and set to the chosen city's name when the owner saves the address.**
Reason: the product list city filter and the cities list read this column.

**Public shop endpoints use optional authentication: a missing, invalid or expired token means guest, never 401. `isOwner` and `ownerDetails` are decided in the service from the verified user id. Responses that can contain owner data are sent with `Cache-Control: private, no-store`.**

**`GET /shops/me` returns `operatingHours` as an object and flat region ids, while `PUT /shops/me` takes flat `openingTime` and `closingTime`. This asymmetry is intentional, and the frontend must follow it. Overnight hours are not supported.**

**Known gaps: the owner edit form has no zip code input, so `zipCode` is optional on update and keeps its current value. The shop email and phone are visible to the owner only, and the owner may want them public. Logo upload is not built.**

**CONTRACT CHANGE: new tables `shipping_options`, `vouchers` and `payment_methods`, with seed data for testing checkout. There are no endpoints for them yet.**
Reason: checkout testing needs data before the shipping, voucher and payment tasks exist. The fields are PROVISIONAL, and those tasks may change them. Prices and amounts are integer IDR. `Voucher.value` means percent off for PERCENT, IDR off for FIXED, and the most IDR of shipping covered for FREE_SHIPPING. A voucher with no `shopId` is a platform voucher. Rules such as "percent is at most 100" and "ends after it starts" are CHECK constraints in the migration.

**The voucher seed uses dates relative to the day it runs, and does not reset `usedCount` on a re-run.**
Reason: the "valid" vouchers must be valid when you test. Running the seed again moves the windows forward and keeps real usage. The seed has edge-case rows on purpose: an expired voucher, one that starts tomorrow, a used-up one and a switched-off one, plus a switched-off shipping option and a disabled payment method.

**CONTRACT CHANGE: new endpoint `POST /shops` creates the user's shop.**
Reason: the create shop page had nothing to call (it returned 404). The body is the same as `PUT /shops/me` (the frontend's request was not available, so check it matches). The user becomes the owner. A user who already has a shop gets 409 `SHOP_ALREADY_EXISTS` (one shop per user, still provisional), and this is also guarded by the unique owner id when two requests race. The slug is made from the name and gets `-2`, `-3` when taken. If two shops pick the same slug at the same moment, the create is retried with the next one.

**CONTRACT CHANGE: region ids are the wilayah.id codes without dots, stored as TEXT. This replaces the earlier rule that region ids come from the seed order.**
Reason: the frontend address form uses wilayah.id and sends its codes (province 2 digits, city 4, district 6, sub-district 10). A 10 digit code such as 3171071001 is larger than 2,147,483,647, so it cannot be a 32 bit integer. TEXT was chosen over BIGINT because Prisma returns BIGINT as a JavaScript bigint, which JSON cannot hold, and because a code is an identifier, not a number. Ids are accepted as `^\d{1,10}$`. Each code starts with its parent's code, so the service checks the prefix as well as the stored parent, and a CHECK constraint in the database enforces the length and the prefix. The migration moves the regions of the earlier seed (ids 1, 2, 3 ...) to their codes, and the shops, drafts and saved addresses that point at them move too (the foreign keys cascade on update). Region names now follow wilayah.id, so "Jakarta Selatan" is "Kota Administrasi Jakarta Selatan". A shop's `city` text keeps its old value until the owner saves the shop again.

**The full region list is loaded with `npm run db:import-regions` (opt-in, from https://wilayah.id). The seed keeps a small subset with real codes.**
Reason: the address form can pick any region in Indonesia, and an address whose regions are not in the database is rejected. The import makes about 8,000 requests, so it is a one-off command, not part of the seed.
