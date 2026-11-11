#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Safe Local Android Release Keystore Generator for Glück
# - Generates a brand-new release keystore with alias "glueckrelease"
# - Never prints or logs passwords
# - Outputs git-ignored files:
#     android/app/release.keystore
#     android/app/release.keystore.b64
# ==============================================================================

KEY_ALIAS="${ANDROID_KEY_ALIAS:-glueckrelease}"
KEYSTORE_PATH="android/app/release.keystore"
KEYSTORE_B64_PATH="android/app/release.keystore.b64"

if ! command -v keytool >/dev/null 2>&1; then
  echo "ERROR: 'keytool' not found. Please install Java JDK 17+ or 21+ first." >&2
  exit 1
fi

if [ -f "$KEYSTORE_PATH" ]; then
  echo "WARNING: $KEYSTORE_PATH already exists."
  read -r -p "Do you want to overwrite it with a brand-new keystore? (y/N): " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted. Existing keystore was not modified."
    exit 0
  fi
  rm -f "$KEYSTORE_PATH" "$KEYSTORE_B64_PATH"
fi

echo "=== Glück Android Release Keystore Setup (Alias: ${KEY_ALIAS}) ==="

if [ -z "${ANDROID_STORE_PASSWORD:-}" ]; then
  read -r -s -p "Enter new Keystore Password (min 6 chars, hidden): " STORE_PASS
  echo ""
  read -r -s -p "Confirm Keystore Password: " STORE_PASS_CONFIRM
  echo ""
  if [ "$STORE_PASS" != "$STORE_PASS_CONFIRM" ]; then
    echo "ERROR: Keystore passwords do not match." >&2
    exit 1
  fi
else
  STORE_PASS="$ANDROID_STORE_PASSWORD"
fi

if [ "${#STORE_PASS}" -lt 6 ]; then
  echo "ERROR: Keystore password must be at least 6 characters." >&2
  exit 1
fi

if [ -z "${ANDROID_KEY_PASSWORD:-}" ]; then
  read -r -s -p "Enter new Key Password for alias '${KEY_ALIAS}' (press Enter to use same as Keystore Password): " KEY_PASS
  echo ""
  if [ -z "$KEY_PASS" ]; then
    KEY_PASS="$STORE_PASS"
  else
    read -r -s -p "Confirm Key Password: " KEY_PASS_CONFIRM
    echo ""
    if [ "$KEY_PASS" != "$KEY_PASS_CONFIRM" ]; then
      echo "ERROR: Key passwords do not match." >&2
      exit 1
    fi
  fi
else
  KEY_PASS="$ANDROID_KEY_PASSWORD"
fi

if [ "${#KEY_PASS}" -lt 6 ]; then
  echo "ERROR: Key password must be at least 6 characters." >&2
  exit 1
fi

mkdir -p "$(dirname "$KEYSTORE_PATH")"

export _GLUECK_TMP_STORE_PASS="$STORE_PASS"
export _GLUECK_TMP_KEY_PASS="$KEY_PASS"

trap 'unset _GLUECK_TMP_STORE_PASS _GLUECK_TMP_KEY_PASS STORE_PASS KEY_PASS STORE_PASS_CONFIRM KEY_PASS_CONFIRM 2>/dev/null || true' EXIT

echo "Generating 2048-bit RSA PKCS12 release keystore..."
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore "$KEYSTORE_PATH" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass:env _GLUECK_TMP_STORE_PASS \
  -keypass:env _GLUECK_TMP_KEY_PASS \
  -dname "CN=Glueck Teacher, OU=Mobile, O=Glueck, L=Cairo, ST=Cairo, C=EG" >/dev/null

echo "Verifying generated keystore and alias '${KEY_ALIAS}'..."
keytool -list \
  -keystore "$KEYSTORE_PATH" \
  -alias "$KEY_ALIAS" \
  -storepass:env _GLUECK_TMP_STORE_PASS >/dev/null

# Encode to single-line Base64 without line wraps
base64 "$KEYSTORE_PATH" | tr -d ' \n\r\t' > "$KEYSTORE_B64_PATH"
chmod 600 "$KEYSTORE_PATH" "$KEYSTORE_B64_PATH"

echo ""
echo "SUCCESS: Brand-new release keystore generated and verified."
echo "  - Keystore file (git-ignored): $KEYSTORE_PATH"
echo "  - Base64 file (git-ignored):   $KEYSTORE_B64_PATH"
echo "  - Key Alias:                   $KEY_ALIAS"
echo ""
echo "Next steps:"
echo "  1. Copy the contents of $KEYSTORE_B64_PATH into the GitHub Secret ANDROID_KEYSTORE_BASE64."
echo "  2. Set ANDROID_KEY_ALIAS to: $KEY_ALIAS"
echo "  3. Set ANDROID_STORE_PASSWORD and ANDROID_KEY_PASSWORD to the passwords you entered."
