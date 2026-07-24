const fs = require('fs');
const path = require('path');

const replacements = [
  // Backgrounds
  { regex: /\bbg-slate-950\b/g, rep: "bg-base" },
  { regex: /\bbg-slate-900\b/g, rep: "bg-base" },
  { regex: /\bbg-slate-800\b/g, rep: "bg-surface" },
  { regex: /\bbg-slate-700\b/g, rep: "bg-raised" },
  
  // Backgrounds with opacity
  { regex: /\bbg-slate-950\/(\d+)\b/g, rep: "bg-base/$1" },
  { regex: /\bbg-slate-900\/(\d+)\b/g, rep: "bg-base/$1" },
  { regex: /\bbg-slate-800\/(\d+)\b/g, rep: "bg-surface/$1" },
  { regex: /\bbg-slate-700\/(\d+)\b/g, rep: "bg-raised/$1" },

  // Borders
  { regex: /\bborder-slate-800\b/g, rep: "border-border" },
  { regex: /\bborder-slate-700\b/g, rep: "border-border" },
  { regex: /\bborder-slate-600\b/g, rep: "border-border" },
  
  // Borders with opacity
  { regex: /\bborder-slate-800\/(\d+)\b/g, rep: "border-border/$1" },
  { regex: /\bborder-slate-700\/(\d+)\b/g, rep: "border-border/$1" },
  { regex: /\bborder-slate-600\/(\d+)\b/g, rep: "border-border/$1" },

  // Texts
  { regex: /\btext-slate-100\b/g, rep: "text-primary" },
  { regex: /\btext-slate-200\b/g, rep: "text-primary" },
  { regex: /\btext-slate-300\b/g, rep: "text-secondary" },
  { regex: /\btext-slate-400\b/g, rep: "text-secondary" },
  { regex: /\btext-slate-500\b/g, rep: "text-secondary" },

  // Placeholders
  { regex: /\bplaceholder-slate-400\b/g, rep: "placeholder:text-secondary" },
  { regex: /\bplaceholder-slate-500\b/g, rep: "placeholder:text-secondary" },

  // Divide
  { regex: /\bdivide-slate-700\b/g, rep: "divide-border" },
  { regex: /\bdivide-slate-700\/(\d+)\b/g, rep: "divide-border/$1" },
  { regex: /\bdivide-slate-800\b/g, rep: "divide-border" },

  // Accent
  { regex: /\bbg-indigo-500\b/g, rep: "bg-accent" },
  { regex: /\bbg-indigo-600\b/g, rep: "bg-accent" },
  { regex: /\bhover:bg-indigo-500\b/g, rep: "hover:bg-accent-hover" },
  { regex: /\bhover:bg-indigo-600\b/g, rep: "hover:bg-accent-hover" },
  { regex: /\btext-indigo-300\b/g, rep: "text-accent" },
  { regex: /\btext-indigo-400\b/g, rep: "text-accent" },
  { regex: /\btext-indigo-500\b/g, rep: "text-accent" },
  { regex: /\bborder-indigo-400\b/g, rep: "border-accent" },
  { regex: /\bborder-indigo-500\b/g, rep: "border-accent" },
  { regex: /\bshadow-indigo-500\/(\d+)\b/g, rep: "shadow-accent/$1" },
  { regex: /\bshadow-indigo-600\/(\d+)\b/g, rep: "shadow-accent/$1" },
  { regex: /\bfocus:border-indigo-500\b/g, rep: "focus:border-accent" },
  { regex: /\bfocus:ring-indigo-500\b/g, rep: "focus:ring-accent" },
  { regex: /\bpeer-focus:ring-indigo-500\b/g, rep: "peer-focus:ring-accent" },
  { regex: /\bpeer-checked:bg-indigo-600\b/g, rep: "peer-checked:bg-accent" },
  { regex: /\bselection:bg-indigo-500\b/g, rep: "selection:bg-accent" },
  { regex: /\bhover:text-indigo-400\b/g, rep: "hover:text-accent" },
  
  // Accent with opacity
  { regex: /\bbg-indigo-500\/(\d+)\b/g, rep: "bg-accent/$1" },
  { regex: /\bborder-indigo-500\/(\d+)\b/g, rep: "border-accent/$1" },

  // Success
  { regex: /\bbg-emerald-400\b/g, rep: "bg-success" },
  { regex: /\bbg-emerald-500\b/g, rep: "bg-success" },
  { regex: /\btext-emerald-400\b/g, rep: "text-success" },
  { regex: /\bbg-emerald-500\/(\d+)\b/g, rep: "bg-success/$1" },

  // Warning
  { regex: /\bbg-amber-400\b/g, rep: "bg-warning" },
  { regex: /\bbg-amber-500\b/g, rep: "bg-warning" },
  { regex: /\btext-amber-300\b/g, rep: "text-warning" },
  { regex: /\btext-amber-400\b/g, rep: "text-warning" },
  { regex: /\bbg-amber-500\/(\d+)\b/g, rep: "bg-warning/$1" },
  { regex: /\bborder-amber-500\/(\d+)\b/g, rep: "border-warning/$1" },

  // Danger
  { regex: /\bbg-rose-500\b/g, rep: "bg-danger" },
  { regex: /\btext-rose-400\b/g, rep: "text-danger" },
  { regex: /\bborder-rose-500\b/g, rep: "border-danger" },
  { regex: /\bfocus:ring-rose-500\b/g, rep: "focus:ring-danger" },
  { regex: /\bbg-rose-500\/(\d+)\b/g, rep: "bg-danger/$1" },

  // Info Blue
  { regex: /\bbg-blue-500\b/g, rep: "bg-info-blue" },
  { regex: /\btext-blue-400\b/g, rep: "text-info-blue" },
  { regex: /\bbg-blue-500\/(\d+)\b/g, rep: "bg-info-blue/$1" },

  // Info Purple
  { regex: /\bbg-purple-500\b/g, rep: "bg-info-purple" },
  { regex: /\btext-purple-400\b/g, rep: "text-info-purple" },
  { regex: /\bbg-purple-500\/(\d+)\b/g, rep: "bg-info-purple/$1" },
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
