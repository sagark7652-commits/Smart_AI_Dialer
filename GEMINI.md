# Project Rules & Workflow Instructions

## Team Collaboration & Auto Git Sync (Pull & Push)
- Multiple team members work on this repository.
- Whenever ANY change, update, or bug fix is made to the codebase in this project, **always immediately** follow this sequence without waiting for the user to ask:
  1. Pull any latest team updates first:
     `git pull --rebase origin main`
  2. Stage all changed files:
     `git add .`
  3. Commit with a descriptive message:
     `git commit -m "<concise descriptive message>"`
  4. Push to remote main branch:
     `git push origin main`
- Never overwrite remote commits; always pull latest changes first before pushing.
- Never wait for the user to explicitly ask to pull or push.
