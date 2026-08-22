#!/bin/bash
FILES="src/components/HodHubView.tsx src/components/ActionPlansView.tsx src/components/ComplaintsSystemView.tsx src/components/HodStudentsView.tsx src/components/StageCommunicationView.tsx"

for file in $FILES; do
  if [ -f "$file" ]; then
    # Buttons padding & text sizes
    sed -i -E 's/px-4 py-2\.5/px-2.5 py-1/g' "$file"
    sed -i -E 's/px-4 py-2/px-2.5 py-1/g' "$file"
    sed -i -E 's/px-3\.5 py-2/px-2.5 py-1/g' "$file"
    sed -i -E 's/px-3\.5 py-2\.5/px-2.5 py-1/g' "$file"
    sed -i -E 's/px-3 py-1\.5/px-2 py-1/g' "$file"
    sed -i -E 's/px-3 py-2/px-2 py-1/g' "$file"
    sed -i -E 's/px-4 py-1\.5/px-2.5 py-1/g' "$file"
    sed -i -E 's/px-5 py-2\.5/px-3 py-1.5/g' "$file"
    sed -i -E 's/px-3\.5 py-1\.5/px-2 py-1/g' "$file"
    sed -i -E 's/p-4/p-2.5/g' "$file"
    sed -i -E 's/p-5/p-3/g' "$file"
    sed -i -E 's/p-6/p-3/g' "$file"
    sed -i -E 's/space-y-4/space-y-2/g' "$file"
    sed -i -E 's/space-y-5/space-y-3/g' "$file"
    sed -i -E 's/space-y-6/space-y-3/g' "$file"
    sed -i -E 's/gap-4/gap-2/g' "$file"
    sed -i -E 's/gap-3/gap-1.5/g' "$file"
    sed -i -E 's/gap-5/gap-2/g' "$file"
    sed -i -E 's/gap-6/gap-3/g' "$file"
    sed -i -E 's/text-sm/text-xs/g' "$file"
    sed -i -E 's/text-xs/text-[11px]/g' "$file"
    
    # Border radius
    sed -i -E 's/rounded-2xl/rounded-xl/g' "$file"
    # we leave rounded-xl as is or rounded-lg
    
    # Remove large headings paragraphs if possible
    # Just generic layout stuff.
    sed -i -E 's/w-6 h-6/w-4 h-4/g' "$file"
    sed -i -E 's/w-5 h-5/w-3.5 h-3.5/g' "$file"
  fi
done
