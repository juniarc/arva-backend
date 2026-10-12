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
