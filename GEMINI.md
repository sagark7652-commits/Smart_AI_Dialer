# Project Rules & Workflow Instructions

## Team Collaboration & Auto Git Sync (Pull & Push)
- Multiple team members work on this repository simultaneously.
- Whenever ANY change, update, or bug fix is made to the codebase in this project, **always immediately** follow this exact sequence without waiting for the user to ask:
  1. `git add .`
  2. `git commit -m "<concise descriptive message>"`
  3. `git pull --rebase origin main` (fetches latest team commits and replays local commit on top cleanly)
  4. `git push origin main`
- If there are remote changes before working, pull with `git pull --rebase origin main`.
- Never overwrite remote commits; always ensure team members' work is pulled and preserved before pushing.
- Never wait for the user to explicitly ask to pull or push to GitHub.
