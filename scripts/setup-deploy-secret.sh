#!/bin/bash
# scripts/setup-deploy-secret.sh
# Generate and configure DEPLOY_WEBHOOK_SECRET

set -euo pipefail

ENV_FILE=".env"

echo "Setting up Deployment Webhook Secret..."

if grep -q "^DEPLOY_WEBHOOK_SECRET=" "$ENV_FILE" 2>/dev/null; then
  echo "DEPLOY_WEBHOOK_SECRET is already configured in $ENV_FILE."
  echo "Existing value will be preserved."
  SECRET_VAL=$(grep "^DEPLOY_WEBHOOK_SECRET=" "$ENV_FILE" | cut -d= -f2-)
  echo ""
  echo "For GitHub Secrets, use your existing value (not fully displayed for security, but starts with ${SECRET_VAL:0:4}...)"
else
  echo "Generating new DEPLOY_WEBHOOK_SECRET..."
  # Generate a 64-char hex string (32 bytes)
  NEW_SECRET=$(openssl rand -hex 32)
  
  if [ ! -f "$ENV_FILE" ]; then
    touch "$ENV_FILE"
  fi
  
  # Ensure file ends with newline before appending
  if [ -s "$ENV_FILE" ] && [ "$(tail -c 1 "$ENV_FILE")" != "" ]; then
    echo "" >> "$ENV_FILE"
  fi
  
  echo "DEPLOY_WEBHOOK_SECRET=$NEW_SECRET" >> "$ENV_FILE"
  echo "Added DEPLOY_WEBHOOK_SECRET to $ENV_FILE."
  echo ""
  echo "============================================================"
  echo "ACTION REQUIRED: Configure GitHub Secrets"
  echo "============================================================"
  echo "Please go to your GitHub repository Settings > Secrets and variables > Actions"
  echo "Add a new repository secret:"
  echo "Name:  DEPLOY_WEBHOOK_SECRET"
  echo "Value: $NEW_SECRET"
  echo "============================================================"
fi
