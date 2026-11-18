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
1. Create a Supabase project and copy its project URL and publishable key into supabase-config.js.
2. Run the complete supabase/schema.sql file in Supabase Dashboard > SQL Editor.
3. Enable Email under Authentication > Providers. Set email confirmation as desired for testing.
4. Enable GitHub Pages for the main branch with the repository root as the source.
5. Open the published page and create an account.

The publishable key is designed for browser use. Never put a service_role or secret key in frontend code. RLS is enabled in the supplied schema; review policies whenever adding tables or features.

## Files
- index.html: app structure
- styles.css: responsive interface
- app.js: Supabase client and app behavior
- supabase-config.js: public project URL and publishable key
- supabase/schema.sql: tables, RPCs, RLS and Realtime setup
