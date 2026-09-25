# Deploying Medusa DTC Starter on Dokploy

This repository contains the official **Medusa DTC Starter** monorepo:
- **`apps/backend`**: Medusa v2 e-commerce engine with built-in Admin (`/app`).
- **`apps/storefront`**: Next.js DTC storefront (can run in Dokploy or on Vercel).
- **PostgreSQL 16**: Relational database with automatic health check.
- **Redis 7**: Workflow queuing, event bus, and caching.

---

## Deployment Steps

### 1. Create Compose Service in Dokploy
1. In your Dokploy project dashboard, click **Create Service** and select **Compose**.
2. Connect your repository: `https://github.com/alejandropulido7/dtc-starter`.
3. Select branch: `main`.

### 2. Set Environment Variables
In the **Environment** tab of your Dokploy Compose service, paste the values from `.env.example`:
- Generate secure secrets using `openssl rand -base64 32` for `JWT_SECRET` and `COOKIE_SECRET`.
- Configure your domains for `MEDUSA_BACKEND_URL`, `STORE_URL`, `STORE_CORS`, `ADMIN_CORS`, and `AUTH_CORS`.

### 3. Configure Domains & Routing
In the **Domains** section of your Dokploy service:
- **Backend API & Admin**:
  - Domain: `api.yourdomain.com`
  - Target Service: `medusa-backend`
  - Port: `9000`
  - Enable **HTTPS / Let's Encrypt**
- **Storefront (if hosting in Dokploy)**:
  - Domain: `yourstore.com`
  - Target Service: `medusa-storefront`
  - Port: `8000`
  - Enable **HTTPS / Let's Encrypt**

*(Note: If you prefer hosting the storefront on Vercel, simply import this repo into Vercel and set the Root Directory to `apps/storefront`).*

### 4. Deploy the Stack
Click **Deploy**. Dokploy will build the images, start PostgreSQL and Redis on the `homelab_mesh` network, run database migrations (`pnpm medusa db:migrate`), and launch the Medusa backend.

### 5. Create Admin User & Seed Initial Data
Once the `medusa-backend` container is running:
1. Open the **Terminal** of the `medusa-backend` container in Dokploy.
2. Create your admin user:
   ```bash
   pnpm medusa user -e admin@yourdomain.com -p YourSecurePassword
   ```
3. Seed default products, regions, and shipping options:
   ```bash
   pnpm medusa exec ./src/scripts/seed.ts
   ```

### 6. Connect Publishable API Key to Storefront
1. Log in to the Admin dashboard at `https://api.yourdomain.com/app`.
2. Go to **Settings > Publishable API Keys**.
3. Copy your publishable key (or create one and link it to your Sales Channel).
4. Update `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` in Dokploy (or in Vercel) and redeploy the storefront.
