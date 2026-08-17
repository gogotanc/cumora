#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(dirname "$script_dir")
local_dir="$project_dir/.local"
secret_file="$local_dir/secrets.env"
template="$project_dir/lzc-manifest.template.yml"
output="$local_dir/lzc-manifest.yml"

mkdir -p "$local_dir"
chmod 700 "$local_dir"

if [ ! -f "$secret_file" ]; then
  umask 077
  db_password=$(openssl rand -hex 24)
  runtime_secret=$(openssl rand -hex 32)
  {
    echo "DB_PASSWORD=$db_password"
    echo "AGENT_RUNTIME_SECRET=$runtime_secret"
  } > "$secret_file"
fi

chmod 600 "$secret_file"
. "$secret_file"

sed \
  -e "s/__DB_PASSWORD__/$DB_PASSWORD/g" \
  -e "s/__AGENT_RUNTIME_SECRET__/$AGENT_RUNTIME_SECRET/g" \
  "$template" > "$output"
chmod 600 "$output"

echo "$output"
