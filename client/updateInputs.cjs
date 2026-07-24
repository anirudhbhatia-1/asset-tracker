const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/components/forms/AddAssetForm.jsx',
  'src/components/forms/AssignmentModal.jsx',
  'src/components/forms/AddEmployeeModal.jsx',
  'src/components/categories/CategoryBuilder.jsx',
  'src/components/inventory/SearchBar.jsx',
  'src/components/settings/GoogleConfigForm.jsx'
];

filesToUpdate.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    // We only want to replace `text-sm` inside classNames that are for inputs.
    // The safest way is to do a regex replace for `text-sm` where it's part of an input styling.
    // In our case, replacing all `text-sm text-primary` or `text-sm font-mono text-primary` or `text-sm text-secondary` is risky.
    // Let's replace `text-sm` with `text-base md:text-sm` specifically in places that look like inputs.
    // Typical input classes: `bg-base border` or `placeholder:text-secondary`.
    
    // Actually, I can just replace `text-sm` with `text-base md:text-sm` if it's on an input/select/textarea.
    content = content.replace(/(<(?:input|select|textarea)[^>]+className=(?:'|"|\{`|`)[^>]*?)\btext-sm\b([^>]*?>)/g, '$1text-base md:text-sm$2');
    
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${file}`);
  }
});
