const fs = require('fs');
const path = require('path');

const replacements = [
  { regex: /\bborder-emerald-500\/(\d+)\b/g, rep: "border-success/$1" },
  { regex: /\bborder-blue-500\/(\d+)\b/g, rep: "border-info-blue/$1" },
  { regex: /\bborder-purple-500\/(\d+)\b/g, rep: "border-info-purple/$1" },
  { regex: /\btext-rose-200(\/\d+)?\b/g, rep: "text-danger$1" },
  { regex: /\btext-rose-300(\/\d+)?\b/g, rep: "text-danger$1" },
  { regex: /\btext-amber-200(\/\d+)?\b/g, rep: "text-warning$1" },
  { regex: /\btext-amber-300(\/\d+)?\b/g, rep: "text-warning$1" },
  { regex: /\btext-blue-200(\/\d+)?\b/g, rep: "text-info-blue$1" },
  { regex: /\btext-blue-300(\/\d+)?\b/g, rep: "text-info-blue$1" },
  { regex: /\bfrom-blue-500\b/g, rep: "from-info-blue" },
  { regex: /\bto-indigo-500\b/g, rep: "to-accent" },
  { regex: /\bbg-blue-400\b/g, rep: "bg-info-blue" },
  { regex: /\bfrom-emerald-500\b/g, rep: "from-success" },
  { regex: /\bto-teal-500\b/g, rep: "to-success" }, // teal-500 isn't mapped, we'll map to success
  { regex: /\bvia-rose-500\b/g, rep: "via-danger" },
  { regex: /\bshadow-\[0_0_12px_#f43f5e\]\b/g, rep: "shadow-[0_0_12px_var(--theme-danger)]" },
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
