# FPL Tulokset – deploy online (Netlify)

Put your site online so anyone can open it in the browser and download the result image. This tutorial uses **Netlify** (free).

---

## Option A: Deploy by dragging the folder (no Git)

### 1. Create a Netlify account
- Go to **[https://www.netlify.com](https://www.netlify.com)**
- Click **Sign up**
- Sign up with **Email**, **GitHub**, or **Google** (choose one)

### 2. Install Netlify CLI (optional – only if you want deploy from terminal later)
You can skip this and use the website only (steps 3–5).

### 3. Prepare your project folder
- Make sure your project works locally (e.g. with Live Server).
- Your folder should contain at least:
  - `index.html`
  - `styles.css`
  - `app.js`
  - `Layers/` (with all PNGs)
  - Font files (`.ttf`) in the project root

### 4. Deploy from the Netlify website
1. Log in at **[https://app.netlify.com](https://app.netlify.com)**
2. On the main dashboard, find the **“Sites”** area.
3. Drag your **entire project folder** (e.g. `FPLMAINOS`) into the **“Drag and drop your site output folder here”** zone.
4. Wait until it says **“Site is live”** (usually 10–30 seconds).
5. Click the generated link (e.g. `https://random-name-12345.netlify.app`). That’s your live site.

### 5. (Optional) Use a nicer URL
- In Netlify: **Site settings** → **Domain management** → **Options** → **Edit site name**.
- Change to something like `fpl-tulokset` so the URL becomes `https://fpl-tulokset.netlify.app`.

---

## Option B: Deploy with GitHub (good for updates)

### 1. Put the project on GitHub
1. Go to **[https://github.com](https://github.com)** and sign in (or create an account).
2. Click **“New repository”** (or the **+** → **New repository**).
3. Name it e.g. `FPLMAINOS`, leave it **Public**, don’t add README.
4. Click **Create repository**.

### 2. Upload your project
**If you don’t use Git on your computer:**
1. On the new repo page, click **“uploading an existing file”**.
2. Drag all your project files and folders (`index.html`, `styles.css`, `app.js`, `Layers/`, fonts, etc.) into the browser.
3. Add a short message (e.g. “Initial upload”) and click **Commit changes**.

**If you use Git:**
```bash
cd C:\Users\sante\Desktop\koodiohjelmat\FPLMAINOS
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/FPLMAINOS.git
git push -u origin main
```
(Replace `YOUR_USERNAME` with your GitHub username.)

### 3. Connect the repo to Netlify
1. Go to **[https://app.netlify.com](https://app.netlify.com)** and log in.
2. Click **“Add new site”** → **“Import an existing project”**.
3. Choose **“Deploy with GitHub”** and authorize Netlify to use your GitHub if asked.
4. Select the **FPLMAINOS** repository.
5. **Build settings** (for a static site like yours):
   - **Branch to deploy:** `main`
   - **Build command:** leave empty
   - **Publish directory:** `.` (a single dot = root of the repo)
6. Click **Deploy site**.

### 4. Later: update the live site
- **If you used “uploading an existing file”:** upload changed files again on GitHub, then in Netlify go to **Deploys** → **Trigger deploy** → **Deploy site**.
- **If you use Git:** after you push to GitHub (`git add .` → `git commit -m "Update"` → `git push`), Netlify will redeploy automatically.

---

## After deploy

- Share the Netlify URL (e.g. `https://fpl-tulokset.netlify.app`) with others.
- They open it in the browser, choose teams and scores, and **“Lataa kuva (PNG)”** will work because the site is served over HTTPS.
- No need to run a server on their side.

---

## Quick reference

| Step              | Where / What |
|------------------|--------------|
| Sign up          | [netlify.com](https://www.netlify.com) → Sign up |
| Drag-and-drop    | [app.netlify.com](https://app.netlify.com) → drag folder into “Drag and drop” |
| Change site name | Site → Domain management → Edit site name |
| GitHub deploy    | Add new site → Import from GitHub → choose repo → Publish directory: `.` |

If something doesn’t work, check that all paths in your HTML/CSS/JS point to files that are in the uploaded folder (e.g. `Layers/`, fonts) and that the folder you drag (or the repo) contains `index.html` at the root.
