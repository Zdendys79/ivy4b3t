#!/bin/bash
# commit.sh - Automatic commit script for ivy4b3t project
# Linux bash equivalent of commit.ps1

set -e  # Exit on error

echo "=== 🐙 Commit Script for B3 ==="

# 1️⃣ Check if there are changes
hasChanges=$(git status --porcelain)

# 2️⃣ If changes exist, perform stash
stashed=false
if [ -n "$hasChanges" ]; then
    echo "[GIT] Uncommitted changes found, performing stash..."
    git stash save "Auto-stash before pull"
    stashed=true
else
    echo "[GIT] No changes found, stash not needed."
fi

# 3️⃣ Pull current state from GIT
echo "[GIT] Updating repository (git pull)..."
git pull

# 4️⃣ Restore stashed changes (if any)
if [ "$stashed" = true ]; then
    echo "[GIT] Restoring stash..."
    git stash pop
fi

# 5️⃣ Get commit message from temporary file
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

# 7️⃣ Push
echo "[GIT] Pushing commit to remote repository..."
git push

# Cleanup
rm "$tempFile"

echo "✅ Commit was successfully created and pushed."