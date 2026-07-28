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
            let modified = false;

            // Pattern: BACKEND_URL + something OR ${BACKEND_URL}
            // The simplest approach is to find all occurrences of:
            // src={\\\\}
            // and replace with:
            // src={variable?.startsWith('http') ? variable : \\\\}

            content = content.replace(/src=\{\\\\\\$\\{BACKEND_URL\\}\\\$\\{([^}]+)\\}\\/g, "src={.startsWith('http') ?  : \\\\\\\\}");
            content = content.replace(/href=\{\\\\\\$\\{BACKEND_URL\\}\\\$\\{([^}]+)\\}\\/g, "href={.startsWith('http') ?  : \\\\\\\\}");

            if (content !== fs.readFileSync(fullPath, 'utf8')) {
                fs.writeFileSync(fullPath, content);
                console.log('Updated', fullPath);
            }
        }
    }
}
processDir('c:/Users/Brian/Desktop/mysunog - Copy/mysunog-frontend/src');
