import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/blue-/g, 'purple-');
content = content.replace(/p-3 mb-2 rounded-lg/g, 'p-2 mb-1 rounded-md');
content = content.replace(/<span className="truncate text-sm font-medium">/g, '<span className="truncate font-medium">'); // adjusting text size if necessary, wait text-sm is good.

fs.writeFileSync('src/App.tsx', content);
console.log('Done!');
