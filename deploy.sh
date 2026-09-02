#!/bin/bash
set -e

PROJECT_NAME="fashionistas"
LIVE_DOMAIN="https://fashionistas.ai"
SENTINEL="AI Stylist"

echo "📦 Building fashionistas..."
npm run build

echo "🚀 Deploying to Cloudflare Pages..."
npx wrangler pages deploy .vercel/output/static --project-name=fashionistas --branch=main

echo "⏳ Waiting for deploy to propagate..."
sleep 10

echo "✅ Verifying live domain..."
RESPONSE=$(curl -s -I "$LIVE_DOMAIN" | head -1)
HTTP_CODE=$(echo "$RESPONSE" | awk '{print $2}')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ FAIL: Domain returned $HTTP_CODE (expected 200)"
  exit 1
fi

echo "✅ PASS: $LIVE_DOMAIN returns 200"
exit 0
