#!/usr/bin/env bash
# Resolve how to pass a zip to `yc serverless function version create`.
#
# Yandex direct --source-path limit: 3.5 MB.
# Larger packages MUST go via Object Storage:
#   --package-bucket-name + --package-object-name
#
# Usage:
#   source deploy/test/cf-package-source.sh
#   CF_VERSION_SOURCE_ARGS=( $(cf_package_source_args /path/to.zip ydb-proxy) )
#   yc serverless function version create ... "${CF_VERSION_SOURCE_ARGS[@]}"
#
# Requires env (from load-env / .env.test):
#   YC_FOLDER_ID
#   CF_PACKAGE_BUCKET   (Object Storage bucket name)
# Optional:
#   CF_PACKAGE_PREFIX   (default: cf-packages)
#   CF_DIRECT_UPLOAD_MAX_BYTES (default: 3500000)

cf_package_source_args() {
  local zip_path="$1"
  local object_slug="${2:-package}"

  if [[ ! -f "$zip_path" ]]; then
    echo "❌ zip not found: $zip_path" >&2
    return 1
  fi

  local size
  size=$(wc -c < "$zip_path" | tr -d ' ')
  local max="${CF_DIRECT_UPLOAD_MAX_BYTES:-3500000}"

  echo "📦 package: $zip_path ($(numfmt --to=iec --suffix=B "$size" 2>/dev/null || echo "${size} bytes"))" >&2

  if [[ "$size" -le "$max" ]]; then
    echo "   ≤ 3.5MB → direct --source-path" >&2
    echo --source-path
    echo "$zip_path"
    return 0
  fi

  echo "   > 3.5MB → Object Storage upload required" >&2

  local bucket="${CF_PACKAGE_BUCKET:-}"
  if [[ -z "$bucket" ]]; then
    echo "❌ Zip is larger than 3.5MB. Set CF_PACKAGE_BUCKET in deploy/test/.env.test" >&2
    echo "   Example:" >&2
    echo "     CF_PACKAGE_BUCKET=checklist-cf-packages-test" >&2
    echo "   Create bucket once:" >&2
    echo "     yc storage bucket create --name checklist-cf-packages-test --folder-id \"\$YC_FOLDER_ID\"" >&2
    echo "   SA needs roles: storage.uploader (or storage.editor) on the bucket/folder" >&2
    return 1
  fi

  : "${YC_FOLDER_ID:?YC_FOLDER_ID required for bucket ensure}"

  # ensure bucket exists
  if ! yc storage bucket get --name "$bucket" >/dev/null 2>&1; then
    echo "=== create Object Storage bucket: $bucket ===" >&2
    yc storage bucket create \
      --name "$bucket" \
      --folder-id "$YC_FOLDER_ID" \
      --default-storage-class standard \
      --max-size 10737418240 \
      >/dev/null
    echo "   bucket created" >&2
  else
    echo "   bucket exists: $bucket" >&2
  fi

  local prefix="${CF_PACKAGE_PREFIX:-cf-packages}"
  local ts
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  local key="${prefix}/${object_slug}/${ts}-$(basename "$zip_path")"

  echo "=== upload s3://${bucket}/${key} ===" >&2
  # yc storage cp works for Object Storage
  if yc storage cp "$zip_path" "s3://${bucket}/${key}" --folder-id "$YC_FOLDER_ID" 2>/dev/null; then
    :
  else
    # fallback s3api
    yc storage s3api put-object \
      --bucket "$bucket" \
      --key "$key" \
      --body "$zip_path" \
      >/dev/null
  fi

  echo "   uploaded OK" >&2
  echo --package-bucket-name
  echo "$bucket"
  echo --package-object-name
  echo "$key"
}

# Read args into array helper for bash callers
#   mapfile -t CF_VERSION_SOURCE_ARGS < <(cf_package_source_args "$zip" "ydb")
# Note: mapfile keeps newlines; we echo one flag/value per line.
