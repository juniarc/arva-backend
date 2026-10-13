# Arva: Project Context and Rules

This file is read by AI coding assistants at the start of every session. Keep it accurate. If a decision changes, update this file and `docs/DECISIONS.md` in the same commit.

## 1. What we are building

Arva is a marketplace website. Users can register, log in, create a shop, list products, add products to a cart and wishlist, and check out. Products are sold by many shops, so there are two kinds of users: buyers and sellers. A user can be both.

The UI is based on the Figma file "Arva". Figma is the source of truth for visual design. If the code and Figma disagree, change the code, unless a decision in `docs/DECISIONS.md` says otherwise.

The full feature list, with status and build order, is in `docs/FEATURES.md`. Read it before starting any task. Only build a feature whose status allows it, and follow the build order.

Current focus: authentication (Login, Sign Up) and the global header. Other features are listed in `docs/FEATURES.md` but are not started yet, so do not build them unless the task asks for them.

## 1a. Roles

- **Guest**: browses, searches, views products and shops. Cannot cart, wishlist, or buy.
- **Buyer**: logged in. Can use cart, wishlist, checkout, and order history.
- **Seller**: a buyer who has created a shop. Manages their own shop, products, vouchers, and discounts.

A user can be both a buyer and a seller. A seller cannot buy from their own shop.

## 1b. Domain glossary

Use these words in code, database names, and UI text. Do not use synonyms.

- **Product**: an item a shop sells. Has images, description, category, tags, shipping cost, and one or more variants.
- **Variant**: a sellable version of a product (for example size or weight), with its own price, stock, and unit.
- **Shop**: a seller's store. Belongs to one user. A user has at most one shop (confirm in DECISIONS.md if this changes).
- **Category**: a product group used for navigation and filters.
- **Tag**: a seller-defined label on products, used for grouping.
- **Discount**: a price reduction on a product, with a type, value, and date range.
- **Voucher**: a code a buyer can apply at checkout, created by a seller or the platform.
- **Cart**: the buyer's pending items, grouped by shop. Items are not reserved stock.
- **Wishlist**: products a buyer saved for later.
- **Order**: a confirmed purchase, created from cart items or a buy-now action. Grouped by shop.
- **Shipment**: the delivery address and shipping option for an order.
- **Buy now**: a checkout for one product that skips the cart.

## 2. Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router), React 18, TypeScript (strict) |
| Styling | Tailwind CSS with theme tokens |
| Forms | react-hook-form + zod |
| Backend | Node.js + Express, TypeScript |
| Database | PostgreSQL with Prisma |
| Payments | Not decided yet. Do not add a payment provider without asking. |
| Package manager | npm only. Do not commit `yarn.lock` or `pnpm-lock.yaml`. |

The old repo (`juniarc/arva-gfp-frontend`) used Formik, Yup, Material Tailwind, Flowbite, and a hosted backend. We are not using those in the new project. Do not copy code from the old repo without reviewing it first.

## 3. Repository layout

This is a monorepo with two apps:

```
arva/
  apps/
    web/          # Next.js frontend
    api/          # Express backend
  docs/
    ARCHITECTURE.md
    CONVENTIONS.md
    DECISIONS.md
  CLAUDE.md
  README.md
```

Frontend folder structure is described in `docs/ARCHITECTURE.md`. Do not invent new top-level folders without updating that file.

## 4. Commands

Run these from the app folder. Do not guess other commands.

- `npm install`: install dependencies
- `npm run dev`: start the dev server
- `npm run build`: production build (must pass before a task is done)
- `npm run lint`: lint
- `npm run typecheck`: TypeScript check with no emit
- `npm test`: unit and component tests

Before saying a task is done, run `typecheck`, `lint`, and `test`, and report the results.

## 5. Non-negotiable rules

Security
- Auth tokens live only in httpOnly, secure (in production), sameSite "lax" cookies. Never use localStorage or sessionStorage for auth data.
- Never store the user id in a separate cookie. Fetch the current user from the backend with the token.
- Never log passwords, tokens, or full form payloads.
- Validate all input on the server, even if the client already validated it.
- Redirect targets after login must be relative paths. Reject anything that is not a path starting with "/" and not "//".
- Secrets come from environment variables. Never commit `.env`. Commit `.env.example` only.

Architecture
- Components do not call `fetch` directly. Use the typed API client in `lib/api`.
- Business logic (pricing, stock, discounts, order rules) lives in the backend service layer, not in React components.
- Keep Server Components by default. Add `"use client"` only when the component needs state, effects, or event handlers.
- Reuse UI primitives from `components/ui`. Do not copy styles between components.
- Do not hard-code hex colors or spacing in components. Use Tailwind theme tokens.

Code quality
- TypeScript strict mode. Do not use `any`. Use `unknown` and narrow it, or write a proper type.
- Define each zod schema once and reuse it on both client and server.
- Name files by their role: `LoginForm.tsx`, `login.schema.ts`, `auth.ts`.
- Keep functions small and pure where possible. Test the logic that matters most.
- Do not leave `console.log` in committed code. Use the logger in `lib/logger.ts`.
- Do not leave commented-out code in committed files.

Scope
- Do one task at a time. If a task touches more than one feature, split it.
- If the design, the spec, and this file disagree, stop and ask. Do not guess.
- Do not add dependencies without a reason written in the commit message.

## 6. Current decisions (summary)

Full history is in `docs/DECISIONS.md`. Decisions below apply to the auth feature. Marketplace-wide decisions are also recorded there.

- Login uses **username and password**, not email.
- Sign Up fields: **username, email, password, confirm password**. No phone number in the current design.
- Login and Sign Up routes are **/login** and **/signup**.
- Google login and sign-up buttons are **UI only** for now and show "Coming soon."
- The global header appears on all auth pages and is a shared component.

## 7. API contract

Endpoints for each feature are added here when the feature starts. If a feature has no endpoints listed, its contract is not decided yet, so ask before writing frontend code that calls it.

All paths below are under the base path `/api` (set in `app.ts`). Errors use one shape: `{ message, code?, errors? }`. Money is an integer in IDR. Ids are strings, except `user_id` which is a number. `imageUrl` is a full URL when the backend has `IMAGE_BASE_URL` set (a full URL stored in the database is returned as is), otherwise a path such as `/images/dummy/x.jpg`.

Auth (in use now):

- `POST /auth/register`
  - Body: `{ username, email, password }`
  - 201: `{ user_id, username, email }`
  - 400: `{ message, errors: { <field>: string } }`
  - 409: `{ message, field: "username" | "email" }` when the username or email is already taken (username wins if both are)
- `POST /auth/login`
  - Body: `{ username, password }`
  - 200: `{ access_token, user: { user_id, username, email } }`
  - 400: `{ message, errors }`. 401: `{ message }`. 429: `{ message }` after 5 failed attempts per 15 minutes per IP and username.
- `GET /auth/me` (header `Authorization: Bearer <token>`)
  - 200: `{ user: { user_id, username, email } }`
  - 401: `{ message: "Please log in." }`
- `GET /health`: 200 `{ status: "ok" }`

Catalog (public):

- `GET /home`: `{ banners: { carousel, promoStrips, sideBanners, verticalBanners }, sections: { popular, fruits, equipments } }`. A banner is `{ id, title, subtitle, buttonLabel, linkUrl, imageUrl }`.
- `GET /categories`: `{ categories: [{ id, slug, name, iconKey }] }`, ordered by sortOrder.
- `GET /products?category=&shop=&exclude=&minPrice=&maxPrice=&minRating=&city=&sort=&discount=&page=&limit=` (strict: unknown query keys give 400)
  - `shop`: a shop slug (unknown: 400 with `errors.shop`). `exclude`: a numeric product id to leave out.
  - `minPrice`, `maxPrice`: whole IDR, 0 or more, compared with the product's lowest variant price. `minPrice` above `maxPrice` gives 400 with `errors.minPrice`.
  - `minRating`: whole number 1 to 5. Unrated products are excluded when it is set.
  - `city`: trimmed, 1 to 100 characters, exact and case-sensitive match on the shop city. An unknown city gives an empty list, not 400.
  - `sort`: `popular` (default: soldCount, rating, id), `newest` (createdAt, id desc), `price_asc`, `price_desc` (lowest price, then id), `relevance` (placeholder: soldCount, ratingCount, id). Every sort ends with id. `discount`: `true` or `false`. `page` default 1. `limit` default 12, max 48.
  - 200: `{ products: [Product], pagination: { page, limit, total, totalPages } }`. 400 for an unknown category or shop, or invalid values.
- `GET /products/cities`: `{ cities: [string] }`. Distinct shop cities that have an active product, sorted A to Z ignoring case. Cached 60 seconds per server instance. Registered before `/products/:slug`, so a product cannot use the slug `cities`.
- `GET /products/recommended?exclude=&excludeShop=&limit=` (strict: unknown keys give 400). Best sellers, leaving out one product id and every product of one shop. `limit` default 6, max 24. 200: `{ products: [Product] }`.
- `GET /products/:slug`: 200 `{ product: ProductDetail }`. 404 `{ message: "Product not found." }`.
- `GET /products/:slug/reviews?page=&limit=` (strict). `limit` default 10, max 50. 200: `{ reviews: [Review], pagination }`. 404 for an unknown or inactive product.
- `GET /shops/:slug`: 200 `{ shop: { slug, name, city, logoUrl, rating: { average, ratingCount }, productCount } }` (productCount counts active products only). 404 `{ message: "Shop not found." }`.
- Product (list item): `{ id, slug, name, categorySlug, categoryName, price, originalPrice, discountPercent, rating, soldCount, city, imageUrl, shopSlug, shopName }`. `price` is the lowest variant price. `originalPrice` and `discountPercent` come from that same variant and are null when it is not discounted. `city` is the shop's city.
- ProductDetail: `{ id, slug, name, description, categorySlug, categoryName, soldCount, rating: { average, ratingCount, reviewCount }, images: [{ id, url, alt }], variants: [{ id, label, unit, price, originalPrice, stock }], defaultVariantId, shop: { slug, name, city, logoUrl, rating: { average, ratingCount } }, reviewPreview: [Review] }`. Images and variants are ordered by position. `defaultVariantId` is the first variant. `reviewPreview` has up to 10 reviews, newest first.
- Review: `{ id, authorName, authorAvatarUrl, rating, text, createdAt }`. `createdAt` is ISO 8601. Reviews are read-only for now.
- The public product and shop endpoints allow 120 requests per minute per IP (429 `{ message }` after that).

Cart (requires `Authorization: Bearer <token>`, 401 otherwise):

- `GET /cart`: `{ items: [{ id, quantity, product: { id, slug, name, imageUrl, shopName, shop: { slug, name } }, variant: { id, label, unit, price, stock } }], itemCount, subtotal }`
  - `shopName` is kept for compatibility and always equals `shop.name`.
  - Items are ordered by shop name, product name, then variant position, so the client can group by shop without sorting.
  - Items whose product is inactive are left out of `items`, `itemCount` and `subtotal`. Their rows are not deleted.
- `POST /cart`
  - Body: `{ variantId: string, quantity: 1..99 }`. Unknown keys are rejected.
  - 200: the full cart, same shape as `GET /cart`. Adding a variant already in the cart increases its quantity.
  - 400: validation, or the cart total for the variant would exceed 99.
  - 404: `{ message: "Product not found." }`
  - 409: `{ message: "This variant is out of stock.", code: "OUT_OF_STOCK" }` or `{ message: "Only <n> left in stock.", code: "INSUFFICIENT_STOCK" }`
  - 429 after 60 requests per minute per user.
  - Stock is checked but not reserved. The cart shows current prices (no snapshot).
- `PATCH /cart/items/:id` (`id` is a numeric string)
  - Body: `{ quantity: 1..99 }`. Unknown keys are rejected. Quantity 0 gives 400 (use DELETE).
  - 200: the full cart. 400: validation. 404: `{ message: "Cart item not found." }` (missing, another user's, or inactive product).
  - 409: `{ message: "This variant is out of stock.", code: "OUT_OF_STOCK" }` or `{ message: "Only <n> left in stock.", code: "INSUFFICIENT_STOCK" }` (n is the variant stock).
  - 429 after 60 requests per minute per user.
- `DELETE /cart/items`
  - Body: `{ itemIds: string[] }`, 1 to 100 numeric strings, duplicates removed. Unknown keys are rejected. The client must send `Content-Type: application/json`.
  - 200: the full cart after removal. Ids that belong to other users or do not exist are ignored, with no error.
  - 400: validation (`errors.itemIds`). 429 after 60 requests per minute per user.

Planned endpoint groups (no contract yet): `/shops`, `/shops/me`, `/products/mine`, `/wishlist`, `/orders`, `/vouchers`, `/reviews`. Each group gets a contract here before its feature begins.

If a backend change is needed, update this section and `docs/DECISIONS.md` first, then the code.

## 8. Keeping this file current

Read `docs/FEATURES.md` for status. When a feature starts, moves status, or finishes, update its row in the same commit as the code. Update section 1a and 1b when roles or domain terms change.

## 9. Working across two devices

Assume the work happens on two machines. Keep them in sync with these rules.

- Everything that matters lives in Git: code, docs, `CLAUDE.md`, and `docs/`. Anything only on one machine does not count as done.
- Start every session with `git pull`. End every session with a commit and `git push`, even if the work is unfinished. Use a `WIP:` prefix for unfinished work.
- Never keep the only copy of a decision in a chat. If you decide something, write it in `docs/DECISIONS.md` and commit it.
- Each machine has its own `.env` file. Keep the same keys in `.env.example`, and never copy real secret values through chat or Git.
- Pin the Node.js version in `.nvmrc` (use Node 20 LTS unless the project says otherwise). Run `node -v` on both machines before starting.
- After pulling, run `npm install` if `package.json` or `package-lock.json` changed.
- Use one branch per task, for example `feature/auth-login`. Merge to `main` only after the checks pass.
- Commit messages follow Conventional Commits: `feat(auth): add login form`, `fix(auth): redirect after login`, `docs: update decisions`.
