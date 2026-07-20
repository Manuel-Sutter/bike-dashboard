Adaptive cycling coach dashboard, built on Garmin ride data. See `PROJECT.md`
for the vision and architecture, `AGENTS.md` for stack conventions.

## Garmin sync setup (one-time)

1. Create a Supabase project, then run `supabase/schema.sql` against it (SQL
   editor in the Supabase dashboard).
2. Set repo secrets so the sync workflow can reach Supabase:
   ```bash
   gh secret set SUPABASE_URL --repo Manuel-Sutter/bike-dashboard
   gh secret set SUPABASE_SERVICE_ROLE_KEY --repo Manuel-Sutter/bike-dashboard
   ```
3. Install the sync script's dependencies locally and authenticate once:
   ```bash
   pip install -r scripts/requirements.txt
   python scripts/garmin_login_once.py
   ```
   Follow the printed instructions to save the resulting session as the
   `GARMIN_TOKENS_B64` secret.
4. From then on, `.github/workflows/garmin-sync.yml` runs daily and can also
   be triggered on demand (`gh workflow run garmin-sync.yml` or via the
   Actions tab).

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
