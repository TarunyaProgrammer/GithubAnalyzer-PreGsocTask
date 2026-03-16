# Deployment Guide: WebiU

This guide explains how to deploy the **WebiU Backend** to Render and the **WebiU Frontend** to Vercel.

## 🚀 Phase 1: Backend & Databases (Render)

1. **Connect Repository**: Go to [Render Dashboard](https://dashboard.render.com/) and click **New > Blueprint**.
2. **Connect GitHub**: Select your repository.
3. **Approve Blueprint**: Render will detect `render.yaml`. It will show a list of services (Postgres, Redis, Backend).
4. **Environment Variables**: In the Render UI, you must manually populate these secret variables:
   - `GITHUB_TOKEN`: Your GitHub Personal Access Token.
   - `GITHUB_ORG`: `c2siorg` (or your target org).
   - `GITHUB_WEBHOOK_SECRET`: A secret string for webhook validation.
5. **Deploy**: Click **Apply**. Wait for the Database and Redis to become healthy before the Backend starts.
6. **Note the URL**: Once deployed, copy your backend URL (e.g., `https://webiu-backend.onrender.com`).

---

## 🎨 Phase 2: Frontend (Vercel)

1. **New Project**: Go to [Vercel Dashboard](https://vercel.com/new).
2. **Import Repo**: Select your repository.
3. **Project Settings**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Angular
4. **Environment Variables**: Add one variable:
   - `apiUrl`: Set this to your **Render Backend URL** (e.g., `https://webiu-backend.onrender.com/api`).
5. **Deploy**: Click **Deploy**.

---

## 🔗 Phase 3: GitHub Webhooks (Optional)

If you want real-time updates:
1. Go to your GitHub Org/Repo settings > **Webhooks**.
2. **Payload URL**: `https://your-render-backend-url.com/webhooks`
3. **Content Type**: `application/json`
4. **Secret**: Use the same `GITHUB_WEBHOOK_SECRET` you set in Render.
5. **Events**: Select "Push," "Repositories," etc.

---

## ✅ Post-Deployment Check
- Visit your Vercel URL.
- Ensure repositories are loading (they are fetched from the Render Backend).
- Try the "Analyze" feature on a repository.
