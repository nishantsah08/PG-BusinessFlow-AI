import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(process.cwd(), 'src');
const allowedPatterns = [];
const violations = [];

function walk(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
            continue;
        }
        if (!/\.(js|jsx|ts|tsx|mjs)$/.test(entry.name)) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            const isDirectApiFetch = /fetch\((['"])\/api\//.test(line);
            if (!isDirectApiFetch) return;
            const normalizedPath = path.relative(process.cwd(), fullPath);
            const isAllowed = allowedPatterns.some((pattern) => pattern.test(normalizedPath));
            if (!isAllowed) {
                violations.push(`${normalizedPath}:${index + 1}: ${line.trim()}`);
            }
        });
    }
}

walk(rootDir);

if (violations.length > 0) {
    console.error('Direct fetch(/api/...) calls are not allowed in client code. Use apiClient instead.\n');
    violations.forEach((entry) => console.error(entry));
    process.exit(1);
}

console.log('No direct fetch(/api/...) calls found in client/src.');
