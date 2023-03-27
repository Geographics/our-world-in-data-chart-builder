#!/usr/bin/env  bash

set -o errexit
set -o pipefail
set -o nounset

if [[ -z "$IMAGE_HOSTING_BUCKET_PATH" ]]; then
  echo 'Please set IMAGE_HOSTING_BUCKET_PATH in .env'
  exit 1
fi

# IMAGE_HOSTING_BUCKET_PATH should be your environment's folder in the owid-image-upload bucket
# e.g. owid-image-upload/staging
# for local development, it should be owid-image-upload/local-yourname
# at least until we decide to instead host images locally, if ever

s3cmd sync s3://owid-image-upload/production/ s3://$IMAGE_HOSTING_BUCKET_PATH/