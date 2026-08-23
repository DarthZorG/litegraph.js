#!/bin/bash

cd "$(dirname "$0")" || exit
rm -rf ../docs/*
../node_modules/.bin/jsdoc -r ../src -d ../docs
