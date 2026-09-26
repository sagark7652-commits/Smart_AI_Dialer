# Project Rules & Workflow Instructions

## Target Repository & Branch
- **Permanent Repository**: `https://github.com/sumitkhomne123-commits/Smart_AI_Dialer.git`
- **Default Branch**: `main`
- **Commits URL**: `https://github.com/sumitkhomne123-commits/Smart_AI_Dialer/commits/main`

## Team Collaboration & Auto Git Sync (Pull & Push)
- Multiple team members work on this repository simultaneously.
- Whenever ANY change, update, or bug fix is made to the codebase in this project, **always immediately** follow this exact sequence without waiting for the user to ask:
  1. `git add .`
  2. `git commit -m "<concise descriptive message>"`
  3. `git pull --rebase origin main` (fetches latest team commits and replays local commit on top cleanly)
  4. `git push origin main`
  5. `node -e "fetch('https://api.vercel.com/v1/integrations/deploy/prj_achNYYSGPCG7xlKWCORJNMivgtmh/JSwjsxAPan', { method: 'POST' }).then(() => console.log('Vercel Redeploy Triggered!'))"`
- If there are remote changes before working, pull with `git pull --rebase origin main`.
- Never overwrite remote commits; always ensure team members' work is pulled and preserved before pushing.
- Never wait for the user to explicitly ask to pull or push to GitHub or Vercel.

