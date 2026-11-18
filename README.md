# NUGGET COUNCIL

Browser-based multiplayer debate rooms.

## MVP included
- Supabase email/password authentication
- Create private servers and join with five-character invite codes
- Server owner controls server details
- Live text discussion using Supabase Realtime
- Responsive desktop/mobile layout and light theme toggle
- Starter UI for structured debates and council bots

Turn-based debate logic and automated bot replies are clearly marked as in development; they are not live yet.

## Setup
1. The project URL and publishable key are stored in `supabase-config.js`. The publishable key is intended for browser use.
2. The live Supabase database has been initialized with `supabase/schema.sql`. For a fresh project, run that file in Supabase Dashboard > SQL Editor.
3. Enable Email under Authentication > Providers. Choose whether email confirmation is required.
4. In GitHub, open Settings > Pages and set the build and deployment source to **GitHub Actions**. The workflow in `.github/workflows/deploy.yml` will deploy on pushes to `main`.
5. After the workflow succeeds, open the GitHub Pages URL and create an account.

Never put a `service_role` or secret key in frontend code. All app tables use Row Level Security. Keep RLS enabled and review policies whenever adding tables or features.

## Files
- `index.html`: app structure
- `styles.css`: responsive interface
- `app.js`: Supabase client and app behavior
- `supabase-config.js`: public project URL and publishable key
- `supabase/schema.sql`: tables, RPCs, RLS and Realtime setup
- `.github/workflows/deploy.yml`: GitHub Pages deployment
