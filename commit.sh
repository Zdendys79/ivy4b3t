#!/bin/bash
# commit.sh - Automatic commit script for ivy4b3t project
# Linux bash equivalent of commit.ps1

set -e  # Exit on error

echo "=== 🐙 Commit Script for B3 ==="

# 1️⃣ First, ensure we're up to date with remote
echo "[GIT] Synchronizing with remote repository..."

# Show current changes (if any)
changes=$(git status --porcelain)
if [ -n "$changes" ]; then
    echo "📋 Found uncommitted changes:"
    git status --short
    echo "📦 These changes will be included in the commit"
else
    echo "✅ No uncommitted changes found"
fi

# Pull latest changes from remote
echo "[GIT] Pulling latest changes..."
if ! git pull; then
    echo "❌ Git pull failed. Please resolve any issues manually and try again."
    exit 1
fi

echo "✅ Repository synchronized with remote"

# 2️⃣ Get commit message from temporary file
tempFile="/tmp/commit_message.txt"
if [ -f "$tempFile" ]; then
    rm "$tempFile"
fi
touch "$tempFile"

# Open editor (nano as fallback if EDITOR not set)
${EDITOR:-nano} "$tempFile"

# Check if commit message is not empty
if [ ! -s "$tempFile" ]; then
    echo "❌ Commit message is empty. Commit cancelled."
    rm "$tempFile"
    exit 1
fi

# 6️⃣ Commit changes
echo "[GIT] Adding all changes..."
git add -A

echo "[GIT] Creating commit..."
git commit -F "$tempFile"

# 3️⃣ Push
echo "[GIT] Pushing commit to remote repository..."
git push

# Cleanup
rm "$tempFile"

echo "✅ Commit was successfully created and pushed."