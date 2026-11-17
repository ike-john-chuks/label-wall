# Label Wall

## Deploy on Netlify with Supabase

The site uses `public/` for the student and facilitator pages, a Netlify
Function for its API, and Supabase for persistent submissions and facilitator
settings.

1. In Supabase, create a project and run [`supabase/schema.sql`](./supabase/schema.sql)
   in the SQL Editor.
2. In Netlify, set these environment variables for the site:
   - `SUPABASE_URL`: the Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: the Supabase service-role/secret key. Keep it
     private; never put it in a browser file or commit it.
   - `ADMIN_KEY`: a long, random facilitator password. For example, generate
     one with `openssl rand -hex 32`.
3. Ensure the variables are available to Netlify Functions, then redeploy.
4. Open `/` for the student screen. Open `/board?key=YOUR_ADMIN_KEY` for the
   facilitator screen. The board refreshes from the API every two seconds.

The app currently stores one shared board per Netlify site. Submission text,
category, moderation status, and timestamp are stored in Supabase. Set an
appropriate retention policy for the data you collect.

## Run locally

Run `node server.js` with Node.js 16 or newer. The local server stores its
submissions in `notes.json`; this local file is separate from the Supabase
production database.
