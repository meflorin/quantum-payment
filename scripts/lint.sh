#!/usr/bin/env bash

set -euxo pipefail

# run solium on contract source code
if [ "$(./node_modules/.bin/solium -d contracts/ | tee /dev/stderr | grep -ic 'error\|warning')" -gt 0 ]; then
  exit 1
fi

# run eslint on test code
if [ "$(./node_modules/.bin/eslint ./test ./migrations | tee /dev/stderr | wc -l)" -gt 0 ]; then
  exit 1
fi
