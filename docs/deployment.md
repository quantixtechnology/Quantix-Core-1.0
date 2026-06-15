# Deployment Webhook Setup

This guide walks through configuring the deployment webhook for automatic deployments from GitHub Actions to the VPS.

## 1. Secret Generation

A secure secret is required to authenticate webhook requests.

Run the setup script on your VPS:
```bash
chmod +x scripts/setup-deploy-secret.sh
./scripts/setup-deploy-secret.sh
```
This script will:
* Generate a secure random 32-byte hex string.
* Automatically append `DEPLOY_WEBHOOK_SECRET=<secret>` to your `.env` file.
* Print the generated secret to the console for you to copy.

## 2. GitHub Secret Setup

You need to provide the same secret to GitHub Actions.

1. Go to your repository on GitHub.
2. Navigate to **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret**.
4. Set the **Name** to `DEPLOY_WEBHOOK_SECRET`.
5. Set the **Value** to the secret generated in step 1.
6. Click **Add secret**.

## 3. VPS .env Setup

If you didn't use the script, you can manually add the secret to your `.env` file on the VPS:
```env
DEPLOY_WEBHOOK_SECRET=your_generated_secret_here
```
*(Make sure the value matches the one in GitHub Actions exactly).*

## 4. PM2 Restart Steps

After updating the `.env` file, you must restart the PM2 process for the application to load the new environment variable.

```bash
pm2 restart quantix-core
# Or reload to avoid downtime
pm2 reload quantix-core
```

## 5. Deployment Verification Steps

To ensure everything is configured correctly, run the verification script on the VPS:

```bash
chmod +x scripts/verify-deploy.sh
./scripts/verify-deploy.sh
```

This will verify:
* `DEPLOY_WEBHOOK_SECRET` exists in `.env`.
* The deploy script path is correct.
* The PM2 process `quantix-core` is running.
* The deploy endpoint configuration exists.

If all checks pass, your webhook is ready to receive requests from GitHub Actions.
