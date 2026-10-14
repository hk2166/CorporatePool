#!/usr/bin/env bash
# Google sign-in setup for CorporatePool (task.md H-2).
#
# Run it in Google Cloud Shell (already signed in), or on your Mac after `gcloud auth login`.
# It needs nothing else from this repo, so you can paste it into Cloud Shell as-is.
#
#   bash gcp-oauth-setup.sh                 # new project
#   bash gcp-oauth-setup.sh <supabase-ref>  # also prints the live redirect URI (ref from H-1)
#   PROJECT_ID=my-project bash gcp-oauth-setup.sh   # reuse a project you already have
#
# What it does: creates the Google Cloud project, then prints the four console pages to open and
# exactly what to type on each. Google has no API or gcloud command for creating a "Sign in with
# Google" web client, so those steps stay as clicks. It does not change your gcloud config.
set -euo pipefail

SUPABASE_REF="${1:-}"
LOCAL_ORIGIN="http://localhost:3000"
LOCAL_CALLBACK="http://127.0.0.1:54321/auth/v1/callback"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "✗ gcloud isn't installed. Use Google Cloud Shell: https://shell.cloud.google.com" >&2
  exit 1
fi

ACCOUNT="$(gcloud auth list --format='value(account)' --filter='status=ACTIVE' 2>/dev/null | head -n 1)"
if [[ -z "$ACCOUNT" ]]; then
  echo "✗ gcloud isn't signed in. Run: gcloud auth login   (or use Cloud Shell)" >&2
  exit 1
fi

if [[ -n "$SUPABASE_REF" && ! "$SUPABASE_REF" =~ ^[a-z0-9]{20}$ ]]; then
  echo "✗ '$SUPABASE_REF' doesn't look like a Supabase project ref (20 lowercase letters/digits," >&2
  echo "  the part before .supabase.co in your project URL)." >&2
  exit 1
fi

# Project IDs are global across Google Cloud, so add a random suffix.
PROJECT_ID="${PROJECT_ID:-corporatepool-$(od -An -N3 -tx1 /dev/urandom | tr -d ' \n')}"

if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "• Using existing project $PROJECT_ID"
else
  echo "• Creating project $PROJECT_ID (signed in as $ACCOUNT)…"
  gcloud projects create "$PROJECT_ID" --name="CorporatePool" --quiet
fi

CONSOLE="https://console.cloud.google.com/auth"
Q="?project=$PROJECT_ID"

cat <<EOF

✓ Project ready: $PROJECT_ID
  Open each link below in a browser signed in as $ACCOUNT.

1. Branding   $CONSOLE/branding$Q
   (If you see "Get started", the same fields come as a short wizard.)
     App name ................ CorporatePool
     User support email ...... $ACCOUNT
     Audience ................ External
     Developer contact ....... $ACCOUNT

2. Audience   $CONSOLE/audience$Q
     Leave the app in Testing for now.
     Test users → Add users → $ACCOUNT   (and anyone else testing; up to 100)

3. Data access   $CONSOLE/scopes$Q
     Add or remove scopes → tick only: openid, .../auth/userinfo.email, .../auth/userinfo.profile
     (Non-sensitive scopes: publishing the app later needs no review by Google.)

4. Create the client   $CONSOLE/clients/create$Q
     Application type ........ Web application
     Name .................... supabase
     Authorized JavaScript origins:
       $LOCAL_ORIGIN
     Authorized redirect URIs:
       $LOCAL_CALLBACK
EOF

if [[ -n "$SUPABASE_REF" ]]; then
  echo "       https://$SUPABASE_REF.supabase.co/auth/v1/callback"
else
  echo "       (after H-1, also add https://<your-ref>.supabase.co/auth/v1/callback)"
fi

cat <<EOF
     Click Create. In the dialog that opens, click DOWNLOAD JSON.
     Google shows the secret only once, so don't close the dialog before downloading.

5. Back on your Mac, write the two values into .env.local (the secret is never printed):
     cd /Users/hemant/Desktop/personal/CorporatePool && node scripts/google-oauth-env.mjs ~/Downloads/client_secret_*.json
EOF

if [[ -n "$SUPABASE_REF" ]]; then
  cat <<EOF

6. Live Supabase: https://supabase.com/dashboard/project/$SUPABASE_REF/auth/providers
     Google → enable, paste the Client ID and Client secret from the JSON, Save.
EOF
fi
