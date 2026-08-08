const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const originalContent = content;

            const regex = /\`\$\{BACKEND_URL\}\$\{([^}]+)\}\`/g;

            content = content.replace(regex, (match, varName) => {
                if (content.includes('.startsWith')) return match;
                return `${varName}?.startsWith('http') ? ${varName} : \`\${BACKEND_URL}\${${varName}}\``;
            });

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content);
                console.log('Updated', fullPath);
            }
        }
    }
}
processDir('c:/Users/Brian/Desktop/mysunog - Copy/mysunog-frontend/src');
