# Vercel Test Deployment

Status: Preview deployment ready; production remains disabled.

## Current Preview

- Project: `lu-zhiyuan/myassist-test`
- Environment: Vercel Preview
- URL: `https://myassist-test-odok95h5k-lu-zhiyuan.vercel.app`
- Deployment: `dpl_DSbzDuzKuLKKR8AYbJDGShjWP7Aq`
- Build status: Ready
- Source upload: 351.5 KB after `.vercelignore`
- Backend: isolated Supabase test project only
- Local SQLite/uploads migration: none

Phase 7 adds formal username/email login, password recovery, developer messages, the protected Admin Dashboard, and the redesigned finance modal. Migrations `202607120006` and `202607120007` were applied only to the isolated Supabase test project before this Preview was built.

## Intended configuration

- Repository: `leolu666999/MyAssist`
- Branch: `main`
- Framework: Next.js
- Root directory: repository root
- Environment: isolated Vercel test deployment
- Backend: Supabase test project only
- Custom domain: none
- Public launch: no

The deployment must configure only the seven variable names listed in `VERCEL_DEPLOYMENT_PREFLIGHT.md`. Values are entered through authenticated local CLI/dashboard workflows and are never copied into this document, chat, GitHub, or browser code.

The deployment can be rolled back from the Vercel deployment list without changing Supabase or local data. Production has not been deployed. Physical iPhone/PWA checks remain a maintainer-run step because the current network resets direct `vercel.app` traffic.
