const fs = require('fs');
const path = require('path');

const replacements = [
  { regex: /\bfocus:ring-slate-500\b/g, rep: "focus:ring-secondary" },
  { regex: /\b(focus:)?ring-offset-slate-900\b/g, rep: "$1ring-offset-base" },
  { regex: /\bbg-slate-500\/10\b/g, rep: "bg-secondary/10" },
  { regex: /\bborder-slate-500\/30\b/g, rep: "border-secondary/30" },
  { regex: /\bborder-slate-500\/20\b/g, rep: "border-secondary/20" },
  { regex: /\btext-slate-600\b/g, rep: "text-secondary" },
  { regex: /\bbg-slate-500\b/g, rep: "bg-secondary" },
  { regex: /\bafter:border-slate-300\b/g, rep: "after:border-border" },
  { regex: /\bfrom-slate-800\b/g, rep: "from-surface" },
  { regex: /\bvia-slate-800\/90\b/g, rep: "via-surface/90" },
  { regex: /\bto-slate-800\/60\b/g, rep: "to-surface/60" },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      for (const { regex, rep } of replacements) {
        content = content.replace(regex, rep);
      }
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src', 'components'));
processDirectory(path.join(__dirname, 'src', 'pages'));
