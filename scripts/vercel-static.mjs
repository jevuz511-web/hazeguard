// Vercel needs a non-empty output folder even though every request goes to api/index.js.
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('vercel-static', { recursive: true });
writeFileSync('vercel-static/README.txt', 'HazeGuard is served entirely by api/index.js.\n');
