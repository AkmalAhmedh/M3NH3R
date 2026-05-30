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

## Netlify + Supabase setup

If you deploy this Next.js app to Netlify and use a Supabase backend, set the following environment variables in your Netlify site settings:

- `SUPABASE_URL` : Your Supabase project URL (example: `https://xyzcompany.supabase.co`).
- `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` : Public anon key for client-side access.
- `SUPABASE_SERVICE_ROLE_KEY` : (Optional, server-only) Service Role key for server functions — keep this secret.
- `OPENROUTER_API_KEY` : (Optional) If you use OpenRouter for LLM calls.

Notes:
- The app prefers `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server (Netlify functions). The client bundles `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Do NOT expose your `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_` variable — it must remain secret.
- After adding env vars in Netlify, trigger a redeploy so the build picks them up.

Example Netlify steps:

1. Go to your Site settings → Build & deploy → Environment.
2. Add the variables listed above and save.
3. Redeploy your site.

If you want help verifying keys or testing the API route locally, tell me and I can add local `.env` examples or debugging helpers.
