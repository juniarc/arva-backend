# Architecture

## Monorepo

```
arva/
  apps/
    web/           # Next.js 15 frontend
    api/           # Express + Prisma backend
  docs/
  CLAUDE.md
```

## Frontend (apps/web)

```
apps/web/
  src/
    app/
      (auth)/
        layout.tsx           # global header + two-column auth layout
        login/page.tsx
        signup/page.tsx
      api/auth/
        login/route.ts       # sets httpOnly token cookie
        register/route.ts
      layout.tsx             # root layout
      middleware.ts          # route protection
    components/
      layout/                # GlobalHeader, TopBar, SearchBar
      ui/                    # Button, TextInput, PasswordInput, Alert, Divider
    features/                # one folder per feature in docs/FEATURES.md
      auth/                  # built first
        components/          # LoginForm, SignupForm, AuthIllustration, GoogleButton
        schemas/             # login.schema.ts, signup.schema.ts
        api/                 # auth.ts (client-side calls)
        types.ts
      products/              # catalog: list, detail, filters, sort, search
      shops/                 # public shop page, create shop
      seller/                # my shop, manage products, tags, vouchers
      cart/                  # cart page, cart drawer, add to cart
      wishlist/
      checkout/              # shipment, buy now, vouchers, payment, place order
      orders/                # order history, seller order management
      reviews/
      profile/
    app/ routes map to features:
      /, /products, /products/[category], /[shopName], /[shopName]/[productSlug]
      /my-shop, /my-shop/create-shop, /cart, /cart/shipment, /buy-now
      /wishlist, /order-history, /login, /signup, /forgot-password
    lib/
      api/                   # typed API client and error mapping
      env.ts                 # validated environment variables
      cookies.ts
      logger.ts
      redirect.ts            # safe redirect helper
  tests/
```

Rules for this layer:
- Route segment names are kebab-case and match the design labels where possible.
- `app/` holds routing and pages only. Pages compose feature components. They do not hold business logic.
- `features/<name>/` contains everything for one feature. A feature may import from `components/ui` and `lib`, but not from another feature's internals.
- `components/` is shared and has no feature-specific logic. If two features need the same component, move it here.
- Feature folders are created when the feature starts, not in advance. The structure above is the plan.
- `lib/` has no React code.

## Backend (apps/api)

```
apps/api/
  src/
    server.ts
    app.ts                   # Express app setup
    routes/                  # HTTP routing only
    controllers/             # parse request, call service, return response
    services/                # business logic (auth, later: pricing, orders)
    repositories/            # Prisma queries only
    middleware/              # auth, validation, error handler
    lib/                     # env, logger, password hashing, token signing
    types/
  prisma/
    schema.prisma
    migrations/
  tests/
```

Layer rules:
- Route → controller → service → repository. Each layer only calls the layer below it.
- Services contain the rules. Controllers do not contain rules.
- Only repositories touch Prisma.
- Validate request bodies with zod at the controller boundary.
- Passwords are hashed with bcrypt or argon2. Never store plain text.
- Tokens are signed JWTs with an expiry. The backend returns the token in the login response, and the Next.js route handler moves it into an httpOnly cookie.

## Auth flow

1. User submits the login form (client component).
2. The form calls `POST /api/auth/login` on the Next.js server (same origin).
3. The route handler validates the body with the shared zod schema and calls the Express backend.
4. On success, the route handler sets the `token` cookie and returns the user.
5. Protected pages are guarded in `middleware.ts`. If there is no token, redirect to `/login?redirect=<path>`.
6. The app reads the current user through a server-side call that uses the cookie.

## Environment variables

Frontend (`apps/web/.env.example`):
- `NEXT_PUBLIC_APP_URL`
- `API_BASE_URL` (server-only, used by route handlers)

Backend (`apps/api/.env.example`):
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
