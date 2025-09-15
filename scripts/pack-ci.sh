#!/bin/bash

# Check for --all flag
if [ "$1" = "--all" ]; then
  PROCESS_ALL=true
else
  PROCESS_ALL=false
fi

# Pack CircleCI config if any files in .circleci/src were changed OR if --all flag is used
if [ "$PROCESS_ALL" = true ] || git diff --cached --name-only | grep -q "^\.circleci/src/"; then
  if ! which circleci > /dev/null; then
    echo "❌ Warning: CircleCI CLI not found! Install the CircleCi CLI to edit the CircleCI configuration."
    exit 0
  fi

  echo "Processing CircleCI configurations..."
  
  if [ "$PROCESS_ALL" = true ]; then
    echo "Processing all directories (--all flag used)"
    # Find all directories in .circleci/src
    dirs=$(find ./.circleci/src -maxdepth 1 -type d -not -path "./.circleci/src" | sed 's|^\./\.circleci/src/||' | sort)
  else
    # Get list of changed files in .circleci/src
    changed_files=$(git diff --cached --name-only | grep "^\.circleci/src/")
    
    # Find unique parent directories of changed files
    dirs=$(echo "$changed_files" | sed 's|^\.circleci/src/||' | cut -d'/' -f1 | sort -u)
  fi
  
  # Process directories
  for dirname in $dirs; do
    dir="./.circleci/src/${dirname}/"
    if [ -d "$dir" ]; then
      output_file="./.circleci/${dirname}.yml"
      
      echo "📦 Packing ${dirname}.yml configuration..."
      if ! circleci config pack "$dir" > "$output_file"; then
        echo "  ❌ Failed to pack ${output_file}"
        exit 1
      fi
      echo "  ✅ Packed ${output_file}"
      
      echo "  🔍 Validating ${output_file}"
      if ! circleci config validate "$output_file"; then
        echo "    ❌ Validating ${output_file} failed"
        exit 1
      fi
      echo "    ✅ ${dirname}.yml configuration validated successfully"
      
      git add "$output_file"
      echo "  📝 ${output_file} staged for commit"
    fi
  done
  
  echo "🎉 All CircleCI configurations processed successfully!"
fi
