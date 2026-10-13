# Arva API

Express + TypeScript + Prisma + PostgreSQL. Covers authentication, the home page, the product catalog, and the cart. The contract is in `CLAUDE.md` section 7.

## Set up on a fresh machine

Needs Node 20 or newer, npm, and a PostgreSQL database (local Docker or Supabase).

```
nvm use                      # picks Node 20 from .nvmrc
npm install                  # also generates the Prisma client
cp .env.example .env         # then edit .env (see below)
```

Edit `.env`:
- `DATABASE_URL`: your database. Local Docker: `postgresql://arva:arva@localhost:5432/arva`. Supabase: use the **session pooler** string (port 5432), not the transaction pooler.
- `JWT_SECRET`: a random string of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

Local database with Docker (creates both `arva` and `arva_test`):

```
docker compose up -d
```

Create the tables, load the dummy catalog, and start the server:

```
npm run db:migrate           # applies the migrations
npm run db:seed              # categories, shops, 17 products, banners. Safe to run again. Creates no users.
npm run dev                  # http://localhost:4000
```

`npm run db:reset` wipes the database and re-applies migrations. **It deletes all data. Local use only.**

On Supabase, also run `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;` for each table (`users`, `categories`, `shops`, `products`, `product_variants`, `banners`, `cart_items`), so the public REST API cannot read them.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Server with hot reload |
| `npm run build` / `npm start` | Compile to `dist/` / run `dist/server.js` |
| `npm run typecheck` / `npm run lint` | Type check / lint `src/` |
| `npm run test:unit` | Unit tests. No database needed |
| `npm test` | All tests. Needs the test database |
| `npm run db:migrate` / `db:deploy` | Apply migrations (dev / production-style) |
| `npm run db:seed` | Load the dummy catalog |

## Tests

Tests use a separate database whose name **must end with `_test`**. They delete all data in it, and refuse to run otherwise. With `docker compose up -d`, `arva_test` already exists and `npm test` applies the migrations itself. To use another database, set `TEST_DATABASE_URL` in `.env`.

## Trying the API with curl

Start the server with `npm run dev` and run `npm run db:seed` first. The examples use bash.

```
API=http://localhost:4000/api
```

### Auth

```
# Register: 201
curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"Alice_01","email":"alice@example.com","password":"secret123"}'

# Duplicate username in a different case: 409 with "field":"username"
curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"ALICE_01","email":"other@example.com","password":"secret123"}'

# Duplicate email: 409 with "field":"email"
curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"someone_else","email":"alice@example.com","password":"secret123"}'

# Short password: 400 with an "errors" object
curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"bob_02","email":"bob@example.com","password":"short"}'

# Login: 200 with access_token
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"alice_01","password":"secret123"}'

# Wrong password and unknown user: the same 401 for both
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"alice_01","password":"wrong-password1"}'
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"nobody","password":"secret123"}'

# Save a token for the next steps
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"alice_01","password":"secret123"}' | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).access_token)")

# /me with a token: 200. Without a token: 401
curl -s $API/auth/me -H "Authorization: Bearer $TOKEN"
curl -s $API/auth/me

# Rate limit: the 6th failed attempt returns 429
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/auth/login \
    -H 'Content-Type: application/json' -d '{"username":"alice_01","password":"wrong-password1"}'
done
```

The rate limit is per IP and username for 15 minutes. Restart the server to clear it while testing.

### Home and catalog

```
curl -s $API/home
curl -s $API/categories

curl -s "$API/products"                                   # popular, page 1, 12 per page
curl -s "$API/products?category=fruits"
curl -s "$API/products?discount=true"
curl -s "$API/products?sort=newest"
curl -s "$API/products?sort=price_asc"                    # by lowest variant price
curl -s "$API/products?sort=price_desc&page=2&limit=5"
curl -s "$API/products?category=nope"                     # 400

curl -s $API/products/bali-banana-fruit                   # 200 with variants
curl -s $API/products/nope                                # 404
```

### Product detail, reviews, shops

```
curl -s $API/products/bali-banana-fruit                    # images, variants, defaultVariantId, shop, rating, reviewPreview
curl -s "$API/products/bali-banana-fruit/reviews"          # 3 reviews, newest first
curl -s "$API/products/bali-banana-fruit/reviews?limit=2&page=2"
curl -s "$API/products/bali-banana-fruit/reviews?limit=51" # 400
curl -s $API/shops/shops-name                              # shop profile with productCount
curl -s $API/shops/nope                                    # 404

curl -s "$API/products?shop=shops-name"                    # only that shop's products
curl -s "$API/products?shop=nope"                          # 400
curl -s "$API/products?exclude=1"                          # without product id 1
curl -s "$API/products/recommended?exclude=1&excludeShop=shops-name&limit=4"
```

### Product filters and cities

```
curl -s "$API/products?minPrice=1000&maxPrice=5000"
curl -s "$API/products?minRating=4"
curl -s "$API/products?city=Jakarta"                 # exact, case-sensitive
curl -s "$API/products?sort=relevance"
curl -s "$API/products?minPrice=5000&maxPrice=1000"  # 400, errors.minPrice
curl -s "$API/products?foo=bar"                      # 400, unknown parameter
curl -s $API/products/cities                         # { "cities": [...] }
```

### Cart

```
# Without a token: 401
curl -s $API/cart

# With a token: 200, empty at first
curl -s $API/cart -H "Authorization: Bearer $TOKEN"

# Find a variant id ("1 kg" of the banana)
VARIANT=$(curl -s $API/products/bali-banana-fruit | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).product.variants[0].id)")

# Add to cart: 200 with the full cart
curl -s -X POST $API/cart -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"variantId\":\"$VARIANT\",\"quantity\":2}"

# Over stock (the hand sprayer has 40): 409 INSUFFICIENT_STOCK, "Only 40 left in stock."
SPRAYER=$(curl -s $API/products/hand-sprayer-2l | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).product.variants[0].id)")
curl -s -X POST $API/cart -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d "{\"variantId\":\"$SPRAYER\",\"quantity\":50}"

# Zero-stock variant (lettuce seeds): 409 OUT_OF_STOCK
SOLD_OUT=$(curl -s $API/products/lettuce-seeds | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).product.variants[0].id)")
curl -s -X POST $API/cart -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"variantId\":\"$SOLD_OUT\",\"quantity\":1}"

# Quantity 0: 400 with errors.quantity
curl -s -X POST $API/cart -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"variantId\":\"$VARIANT\",\"quantity\":0}"

# GET /cart now has product.shop { slug, name } on each item, ordered by shop, product, variant
ITEM=$(curl -s $API/cart -H "Authorization: Bearer $TOKEN" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).items[0].id)")

# Change the quantity: 200 with the full cart
curl -s -X PATCH $API/cart/items/$ITEM -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"quantity":5}'

# Above the stock: 409 INSUFFICIENT_STOCK
curl -s -X PATCH $API/cart/items/$ITEM -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"quantity":99}'

# Quantity 0: 400, errors.quantity says to use DELETE
curl -s -X PATCH $API/cart/items/$ITEM -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"quantity":0}'

# No token: 401
curl -s -X PATCH $API/cart/items/$ITEM -H 'Content-Type: application/json' -d '{"quantity":2}'

# Remove items (the body needs Content-Type: application/json): 200 with the remaining cart
curl -s -X DELETE $API/cart/items -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"itemIds\":[\"$ITEM\"]}"

# An id of another user (or an unknown id) is ignored: 200, nothing removed
curl -s -X DELETE $API/cart/items -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"itemIds":["999999"]}'

# Empty list: 400 with errors.itemIds
curl -s -X DELETE $API/cart/items -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"itemIds":[]}'

# No token: 401
curl -s -X DELETE $API/cart/items -H 'Content-Type: application/json' -d '{"itemIds":["1"]}'
```

### Wishlist

```
curl -s $API/wishlist                                      # 401
curl -s $API/wishlist -H "Authorization: Bearer $TOKEN"    # 200, empty at first

PRODUCT=$(curl -s $API/products/bali-banana-fruit | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).product.id)")
curl -s -X POST $API/wishlist -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"productId\":\"$PRODUCT\"}"   # 200, full list
curl -s -X POST $API/wishlist -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"productId\":\"$PRODUCT\"}"   # 200, same list, no duplicate
curl -s -X POST $API/wishlist -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"productId":"999999"}'          # 404

ITEM=$(curl -s $API/wishlist -H "Authorization: Bearer $TOKEN" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).items[0].id)")
curl -s -X DELETE $API/wishlist/items -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"itemIds\":[\"$ITEM\"]}"   # 200, remaining list
# An id of another user (or unknown): 200, nothing removed
curl -s -X DELETE $API/wishlist/items -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"itemIds":["999999"]}'
# Empty list: 400 with errors.itemIds
curl -s -X DELETE $API/wishlist/items -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"itemIds":[]}'
# No token: 401
curl -s -X POST $API/wishlist -H 'Content-Type: application/json' -d '{"productId":"1"}'
curl -s -X DELETE $API/wishlist/items -H 'Content-Type: application/json' -d '{"itemIds":["1"]}'
```

### Regions and checkout draft

```
curl -s $API/regions/provinces                          # no token needed
curl -s $API/regions/provinces/1/cities
curl -s $API/regions/cities/1/districts
curl -s $API/regions/districts/1/sub-districts
curl -s $API/regions/provinces/abc/cities               # 400
curl -s $API/regions/provinces/999/cities               # 404

curl -s $API/checkout                                   # 401
curl -s $API/checkout -H "Authorization: Bearer $TOKEN" # 404 until a draft exists

# Add something to the cart first, then draft it
ITEM=$(curl -s -X POST $API/cart -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"variantId\":\"$VARIANT\",\"quantity\":2}" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).items[0].id)")
curl -s -X POST $API/checkout -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"itemIds\":[\"$ITEM\"]}"
curl -s -X POST $API/checkout -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"itemIds":[]}'            # 400
curl -s -X POST $API/checkout -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"itemIds":["999999"]}'  # 400

# Address (ids 1 = DKI Jakarta, Jakarta Selatan, Kebayoran Baru, Gunung in the seed)
curl -s -X PUT $API/checkout/address -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"label":"Home","province":{"id":"1"},"city":{"id":"1"},"district":{"id":"1"},"subDistrict":{"id":"1"},"street":"Jl. Mawar 1","recipientName":"Alice","phone":"081234567890"}'
# City 3 (Kota Bandung) is not in province 1: 400 with errors.city
curl -s -X PUT $API/checkout/address -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"label":"Home","province":{"id":"1"},"city":{"id":"3"},"district":{"id":"1"},"subDistrict":{"id":"1"},"street":"Jl. Mawar 1","recipientName":"Alice","phone":"081234567890"}'
```

### Profile

```
curl -s $API/profile                                    # 401
curl -s $API/profile -H "Authorization: Bearer $TOKEN"  # 200, address null at first

curl -s -X PUT $API/profile -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"name":"Alice Wonder","username":"alice","email":"alice@example.com","phone":"+6281234567890"}'
# Another user's username: 409 with field "username"
curl -s -X PUT $API/profile -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"name":"Alice","username":"bob","email":"alice@example.com","phone":null}'
# Phone with a space: 400 with errors.phone
curl -s -X PUT $API/profile -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"name":"Alice","username":"alice","email":"alice@example.com","phone":"+62 812"}'
curl -s -X PUT $API/profile -H 'Content-Type: application/json' -d '{}'   # 401

# Address (ids 1 = Gunung, Kebayoran Baru, Jakarta Selatan, DKI Jakarta in the seed)
curl -s -X PUT $API/profile/address -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"street":"Jl. Mawar 1","subDistrict":{"id":"1"},"district":{"id":"1"},"city":{"id":"1"},"province":{"id":"1"},"zipCode":"12110"}'
# City 3 (Kota Bandung) is not in province 1: 400 with errors.city
curl -s -X PUT $API/profile/address -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"street":"Jl. Mawar 1","subDistrict":{"id":"1"},"district":{"id":"1"},"city":{"id":"3"},"province":{"id":"1"},"zipCode":"12110"}'
# Zip "1234": 400 with errors.zipCode
curl -s -X PUT $API/profile/address -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"street":"Jl. Mawar 1","subDistrict":{"id":"1"},"district":{"id":"1"},"city":{"id":"1"},"province":{"id":"1"},"zipCode":"1234"}'
curl -s -X PUT $API/profile/address -H 'Content-Type: application/json' -d '{}'   # 401
```

