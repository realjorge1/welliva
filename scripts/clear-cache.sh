#!/bin/bash
# Welliva Cache Clear Script
# Run this script to clear all caches and ensure fresh code is loaded

echo "🧹 Clearing all Welliva caches..."

# Clear Expo cache
echo "📱 Clearing Expo cache..."
rm -rf .expo/web/cache 2>/dev/null
rm -rf node_modules/.cache 2>/dev/null

# Clear Metro bundler cache
echo "📦 Clearing Metro bundler cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null
rm -rf $TMPDIR/haste-map-* 2>/dev/null

# Clear React Native cache
echo "⚛️ Clearing React Native cache..."
rm -rf $TMPDIR/react-* 2>/dev/null

# Clear watchman cache (if available)
if command -v watchman &> /dev/null; then
    echo "👁️ Clearing Watchman cache..."
    watchman watch-del-all 2>/dev/null
fi

echo "✅ All caches cleared!"
echo ""
echo "🚀 To start the app with a fresh cache, run:"
echo "   npx expo start --clear"
echo ""
echo "Or use the dev command which runs Convex + Expo:"
echo "   npm run dev"
