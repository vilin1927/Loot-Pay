#!/bin/bash

# Print header
echo "🧹 LootPay MVP Cleanup Script"
echo "============================="

# Function to check if a directory exists and remove it
remove_directory() {
    if [ -d "$1" ]; then
        echo "🗑️  Removing directory: $1"
        rm -rf "$1"
    else
        echo "ℹ️  Directory not found: $1"
    fi
}

# Function to remove .old files
remove_old_files() {
    echo "🗑️  Removing .old files..."
    find . -type f -name "*.old" -exec rm -f {} \;
}

# List of directories to remove
DIRS_TO_REMOVE=("node" "logs" "src")

# List of directories to preserve
DIRS_TO_PRESERVE=("prd" "specifications" "research" "assets")

# List of files to preserve
FILES_TO_PRESERVE=(".env" ".cursorrules" "cursorrules.md")

# Check if we're in the right directory
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found. Please run this script from the project root directory."
    exit 1
fi

# Confirm with user
echo "⚠️  This script will remove the following directories:"
for dir in "${DIRS_TO_REMOVE[@]}"; do
    echo "   - $dir/"
done
echo "And all files ending with .old"
echo ""
echo "The following will be preserved:"
for dir in "${DIRS_TO_PRESERVE[@]}"; do
    echo "   - $dir/"
done
for file in "${FILES_TO_PRESERVE[@]}"; do
    echo "   - $file"
done
echo ""
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

# Remove directories
for dir in "${DIRS_TO_REMOVE[@]}"; do
    remove_directory "$dir"
done

# Remove .old files
remove_old_files

echo "✅ Cleanup completed successfully!" 