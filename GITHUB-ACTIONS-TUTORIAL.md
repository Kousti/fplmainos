# Full tutorial: GitHub Action to update matches.json every day

This guide explains how to use the **Update matches** GitHub Action so that `matches.json` is refreshed automatically every day (and optionally when you click “Run workflow”). After the Action runs and pushes the updated file, **Vercel** (or Netlify) will redeploy your site so the live app always shows the latest data.

---

## What the workflow does

1. **Runs on a schedule** – Every day at **08:00 UTC** (e.g. 10:00 or 11:00 in Finland, depending on daylight saving).
2. **Runs on demand** – You can trigger it manually from the GitHub **Actions** tab (**Run workflow**).
3. **Steps it runs:**
   - Checks out your repo.
   - Sets up Python and installs **Google Chrome** (needed for the scraper).
   - Installs Python dependencies from `requirements.txt` (including Selenium and webdriver-manager).
   - Runs `python scrapematches.py`, which scrapes Leagues.gg and writes `matches.json`.
   - If `matches.json` changed, it commits and pushes that file to the same branch.

4. **Result** – A new commit on your default branch (e.g. `main`) with updated `matches.json`. If the repo is connected to Vercel (or Netlify), that push triggers a new deploy, so the live site gets the new data.

---

## Prerequisites

- The project is in a **GitHub repository** (you can create one at [github.com/new](https://github.com/new)).
- The repo contains the workflow file: **`.github/workflows/update-matches.yml`** (it’s already in this project).
- You will use **Vercel** (or Netlify) and connect it to this repo so that **every push** (including the one from the Action) triggers a deploy.

---

## Step 1: Push the project to GitHub

If the project is not on GitHub yet:

1. Go to [github.com](https://github.com) and sign in.
2. Click **New repository**.
3. Name it (e.g. `FPLMAINOS`), set it to **Public**, and create the repo **without** a README.
4. On your computer, in the project folder, run:

```bash
cd path\to\FPLMAINOS
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/FPLMAINOS.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username and `FPLMAINOS` with your repo name if different.

Make sure the repo contains:

- `.github/workflows/update-matches.yml`
- `scrapematches.py`
- `requirements.txt`
- `matches.json` (can be from a previous local run)

---

## Step 2: Allow the Action to push to the repo

The workflow needs permission to push the commit with updated `matches.json`.

1. Open your repo on GitHub.
2. Go to **Settings** → **Actions** → **General**.
3. Under **Workflow permissions**, select **Read and write permissions**.
4. Click **Save**.

If you leave “Read repository contents and packages permissions” only, the push step will fail with a permission error.

---

## Step 3: Run the workflow once (manual test)

1. In the repo, open the **Actions** tab.
2. In the left sidebar, click **Update matches**.
3. Click **Run workflow** (right side), then the green **Run workflow** button.
4. Wait for the job to finish (yellow = running, green = success, red = failed).

If it succeeds:

- You’ll see a new commit on `main` (or your default branch) with message like `chore: update matches.json [automated]`.
- The **Commit and push** step only runs if `matches.json` actually changed.

If it fails:

- Click the run, then the **scrape-and-push** job, and read the failed step (e.g. **Run scraper** or **Install Google Chrome**). See **Troubleshooting** below.

---

## Step 4: Deploy the site on Vercel (so updates go live)

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New…** → **Project**.
3. **Import** your GitHub repo (e.g. `FPLMAINOS`).
4. **Configure:**
   - **Framework Preset:** Other (or leave as detected).
   - **Build Command:** leave empty (static site).
   - **Output Directory:** `.` (root).
   - **Install Command:** leave empty unless you add a build step later.
5. Click **Deploy**.

After the first deploy:

- Every **push** to the default branch (including the one from the GitHub Action) will trigger a new Vercel deploy.
- So when the Action updates `matches.json` and pushes, the live site will automatically get the new data.

Optional: in Vercel → **Settings** → **Git** you can see which branch is used for production (usually `main`). The Action is set up to push to the branch that was checked out; if the scheduled run uses the default branch, that’s the one Vercel will deploy.

---

## Step 5: Schedule (already set)

The workflow file already contains a schedule:

```yaml
schedule:
  - cron: "0 8 * * *"
```

That means **every day at 08:00 UTC**. GitHub runs scheduled workflows from the default branch; they may be delayed a few minutes.

To change the time, edit `.github/workflows/update-matches.yml` and adjust the cron (e.g. `0 6 * * *` for 06:00 UTC). Then commit and push the change.

---

## Summary

| Step | What to do |
|------|------------|
| 1 | Push project to GitHub (include `.github/workflows/update-matches.yml`). |
| 2 | Repo **Settings** → **Actions** → **General** → **Read and write permissions** → Save. |
| 3 | **Actions** → **Update matches** → **Run workflow** to test. |
| 4 | Connect the repo to Vercel and deploy so each push (including from the Action) redeploys the site. |
| 5 | Schedule is already in the workflow (daily at 08:00 UTC). |

After this, the Action will update `matches.json` every day and push it; Vercel will redeploy so the live app always uses the latest matches.

---

## Troubleshooting

### “Permission denied” or “refusing to allow … to create merge commit”

- Ensure **Settings** → **Actions** → **General** → **Workflow permissions** is set to **Read and write permissions** and you saved.

### Scraper step fails (e.g. “Chrome failed to start”, timeout, or no matches)

- The site (Leagues.gg) might be slow or the page structure may have changed. Check the **Run scraper** log.
- If the site blocks or requires different selectors, you may need to adjust `scrapematches.py` (e.g. wait longer, different XPath/CSS).
- Running the same command locally (`python scrapematches.py`) helps verify the script still works.

### “No changes to matches.json”

- The workflow still **succeeds**; it just doesn’t commit. That’s normal when the scraped data is the same as the last run.

### Scheduled run doesn’t happen

- Scheduled workflows can be delayed; they also require the repo to have had some activity. Make sure the workflow file is on the **default branch** (e.g. `main`).
- You can always run it manually from **Actions** → **Update matches** → **Run workflow**.

### Vercel doesn’t redeploy after the Action pushes

- In Vercel, check **Settings** → **Git** and confirm the production branch is the one the Action pushes to (usually `main`).
- In the repo, check that the Action run completed and that there is a new commit with updated `matches.json` on that branch.

---

## Quick reference

- **Workflow file:** `.github/workflows/update-matches.yml`
- **Schedule:** daily at 08:00 UTC
- **Manual run:** Repo → **Actions** → **Update matches** → **Run workflow**
- **Permissions:** **Settings** → **Actions** → **General** → **Read and write permissions**
