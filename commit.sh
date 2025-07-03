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
    
    # Try to pop stash and check for conflicts
    if git stash pop; then
        echo "[GIT] Stash restored successfully."
    else
        echo "⚠️ Merge conflicts detected during stash pop!"
        echo "Please resolve conflicts manually and then run:"
        echo "  git add -A"
        echo "  git stash drop"
        echo "  ./commit.sh"
        exit 1
    fi
    
    # Additional check for unresolved conflicts
    if git status --porcelain | grep -q "^UU\|^AA\|^DD\|^AU\|^UA\|^DU\|^UD"; then
        echo "❌ Unresolved merge conflicts found:"
        git status --porcelain | grep "^UU\|^AA\|^DD\|^AU\|^UA\|^DU\|^UD"
        echo ""
        echo "Please resolve conflicts manually:"
        echo "1. Edit conflicted files"
        echo "2. Remove conflict markers (<<<<<<< ======= >>>>>>>)"
        echo "3. Run: git add <resolved-files>"
        echo "4. Run: ./commit.sh"
        exit 1
    fi
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

# 6️⃣ Final conflict check before commit
if git status --porcelain | grep -q "^UU\|^AA\|^DD\|^AU\|^UA\|^DU\|^UD"; then
    echo "❌ Cannot commit: Unresolved merge conflicts still exist!"
    git status --porcelain | grep "^UU\|^AA\|^DD\|^AU\|^UA\|^DU\|^UD"
    rm "$tempFile"
    exit 1
fi

# Commit changes
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