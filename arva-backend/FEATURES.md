# Feature Map

This is the full scope of Arva. Every feature is listed here, even ones not built yet. Update the status column when a feature starts or finishes.

Status values: `Not started`, `Design pending` (no Figma frame yet), `In progress`, `Done`, `Parked` (decided to postpone).

## Roles

- **Guest**: can browse, search, and view products and shops. Cannot cart, wishlist, or buy.
- **Buyer**: a logged-in user who can use the cart, wishlist, checkout, and order history.
- **Seller**: a buyer who has created a shop. Can manage their own shop, products, vouchers, and discounts.

A user can be a buyer and a seller at the same time. Sellers can buy from other shops, but a seller cannot buy from their own shop.

## Features

| # | Area | Feature | Who | Status | Design source |
|---|---|---|---|---|---|
| 1 | Auth | Login (username + password) | Guest | In progress | Figma: Login, success and error states |
| 2 | Auth | Sign Up (username, email, password) | Guest | In progress | Figma: Sign Up |
| 3 | Auth | Google login and sign-up | Guest | Parked (UI shows "Coming soon") | Figma: Login, Sign Up |
| 4 | Auth | Forgot password | Guest | Design pending (placeholder route only) | Figma: link on Login |
| 5 | Auth | Log out | Buyer, Seller | Not started | Not in design yet |
| 6 | Layout | Global header (top bar, search, Wishlist, Cart, My Profile) | All | In progress (auth pages) | Figma: auth frames |
| 7 | Layout | Footer | All | Design pending | Not in design yet |
| 8 | Home | Home page with hero, categories, and product sections | Guest | Design pending | Figma: home |
| 9 | Products | Product list by category | Guest | Design pending | Figma: products |
| 10 | Products | Filters (price, category, and other attributes) | Guest | Design pending | Figma: filter modal |
| 11 | Products | Sort (for example newest, price, best selling) | Guest | Design pending | Figma: sort |
| 12 | Products | Search (products, categories, shops) | Guest | Design pending | Figma: search results |
| 13 | Products | Product detail (images, variants, stock, price, discount, reviews) | Guest | Design pending | Figma: product detail |
| 14 | Products | Ratings and reviews | Buyer (write), Guest (read) | Design pending | Figma: review section, rating modal |
| 15 | Shops | Public shop page (shop info, products) | Guest | Design pending | Figma: shop page |
| 16 | Shops | Create shop | Buyer | Design pending | Figma: create shop |
| 17 | Seller | My shop dashboard | Seller | Design pending | Figma: my shop |
| 18 | Seller | Manage products (create, edit, status, stock, variants) | Seller | Design pending | Figma: manage product modal |
| 19 | Seller | Tags | Seller | Design pending | Figma: tag modal |
| 20 | Seller | Vouchers and discounts | Seller | Design pending | Figma: voucher section |
| 21 | Cart | Add to cart (with variant and quantity) | Buyer | Design pending | Figma: add to cart modal |
| 22 | Cart | Cart page and cart drawer | Buyer | Design pending | Figma: cart |
| 23 | Wishlist | Add and remove wishlist items | Buyer | Design pending | Figma: wishlist |
| 24 | Checkout | Shipment: address and shipping option | Buyer | Design pending | Figma: shipment, address, shipping modal |
| 25 | Checkout | Buy now (single product, skips the cart) | Buyer | Design pending | Figma: buy now |
| 26 | Checkout | Vouchers at checkout | Buyer | Design pending | Figma: voucher modal |
| 27 | Checkout | Payment method selection | Buyer | Design pending | Figma: payment modal |
| 28 | Checkout | Place order and confirmation | Buyer | Design pending | Figma: success modal |
| 29 | Checkout | Payment provider integration | Buyer | Parked (decide after main features) | None |
| 30 | Orders | Order history and order status | Buyer | Design pending | Figma: order history |
| 31 | Orders | Seller order management | Seller | Not started | Not in design yet |
| 32 | Profile | View and edit profile, address | Buyer | Design pending | Not in design yet |

## Build order

1. Auth (features 1, 2, 6)
2. Catalog read-only: home, product list, filters, sort, product detail, shop page (8 to 15)
3. Seller setup: create shop and manage products (16 to 19)
4. Cart and wishlist (21 to 23)
5. Checkout and orders (24 to 28, 30)
6. Reviews, vouchers and discounts, and seller orders (14, 20, 26, 31)
7. Payment provider (29), profile (32), and the rest

Reason for this order: catalog and auth are needed by everything else. Cart and checkout depend on products, variants, and stock. Payments come last because they need the rest to be stable.

## Rule for adding a feature

Before writing code for a feature, it must have:
1. A row in this table with a status.
2. A Figma frame, or a written decision in `DECISIONS.md` that says the design is not needed.
3. Its API endpoints added to `CLAUDE.md` section 7 (or a separate `docs/API.md`).
