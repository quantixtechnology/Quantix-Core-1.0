#!/usr/bin/env bash
# =============================================================================
# install-runner.sh — Install GitHub Actions self-hosted runner on the VPS
#
# Run this ONCE on the VPS via Hostinger web terminal:
#   bash /home/ubuntu/Quantix-Core-1.0/scripts/install-runner.sh <REGISTRATION_TOKEN>
#
# Get the token:
#   github.com → quantixtechnology/Quantix-Core-1.0 →
#   Settings → Actions → Runners → New self-hosted runner →
#   copy the token shown in the "Configure" step (looks like ABCDEFG1234567)
#
# After this runs, every push to main deploys automatically — no SSH needed.
# =============================================================================

set -euo pipefail

TOKEN="${1:-}"
if [ -z "$TOKEN" ]; then
  echo "Usage: bash install-runner.sh <REGISTRATION_TOKEN>"
  echo ""
  echo "Get the token at:"
  echo "  github.com → quantixtechnology/Quantix-Core-1.0 →"
  echo "  Settings → Actions → Runners → New self-hosted runner"
  exit 1
fi

REPO="https://github.com/quantixtechnology/Quantix-Core-1.0"
RUNNER_DIR="/root/actions-runner"
RUNNER_VERSION="2.325.0"
RUNNER_ARCHIVE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_ARCHIVE}"

echo "============================================================"
echo " GitHub Actions Runner Installation"
echo "============================================================"
echo "Repo    : $REPO"
echo "Dir     : $RUNNER_DIR"
echo "Version : $RUNNER_VERSION"
echo ""

# ── Download and extract ──────────────────────────────────────────────────────
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

echo "── Downloading runner…"
curl -fsSL -o "$RUNNER_ARCHIVE" "$RUNNER_URL"
tar xzf "$RUNNER_ARCHIVE"
rm -f "$RUNNER_ARCHIVE"
echo "✅ Runner downloaded"

# ── Configure ────────────────────────────────────────────────────────────────
echo ""
echo "── Configuring runner…"
./config.sh \
  --url "$REPO" \
  --token "$TOKEN" \
  --name "quantix-vps" \
  --labels "self-hosted,linux,x64" \
  --work "/root/actions-runner/_work" \
  --unattended \
  --replace
echo "✅ Runner configured"

# ── Install as systemd service (auto-start on reboot) ────────────────────────
echo ""
echo "── Installing as systemd service…"
./svc.sh install root
./svc.sh start
echo "✅ Runner service started"

echo ""
echo "── Service status:"
./svc.sh status

echo ""
echo "============================================================"
echo " Runner installed and running."
echo ""
echo " The next push to main will deploy automatically."
echo " No SSH, no firewall changes needed."
echo ""
echo " Manage the runner:"
echo "   cd /root/actions-runner && ./svc.sh status"
echo "   cd /root/actions-runner && ./svc.sh stop"
echo "   cd /root/actions-runner && ./svc.sh start"
echo "============================================================"
