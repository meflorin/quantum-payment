#!/usr/bin/env bash

set -euxo pipefail

# show truffle, Solidity and Node version first
./node_modules/.bin/truffle version

if [ $(./node_modules/.bin/truffle compile --all | tee /dev/stderr | grep -i -c -e "warning\|error") -gt 0 ]; then
    echo "Found errors or warnings in contract compilation. Exiting..."
    exit 1
fi

yarn run lint
yarn run test
yarn run coverage

rm -rf build \
  && ./node_modules/.bin/truffle compile \
  && tar czf build.tar.gz ./build
