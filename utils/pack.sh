#!/bin/bash
set -eo pipefail
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.."
npm run build
