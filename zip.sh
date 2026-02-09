#!/bin/bash

ZIP_FILE="address-label.zip"

if [ -f "$ZIP_FILE" ]; then
    rm "$ZIP_FILE"
fi

cd src

echo "Creating ../$ZIP_FILE from src/..."

zip -r "../$ZIP_FILE" manifest.json content.js content.css popup.html popup.js icons

cd ..
echo "Done. $ZIP_FILE created."
