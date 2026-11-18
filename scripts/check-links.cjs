const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'src', 'app');

function getAppRoutes(dir, baseRoute = '') {
  let routes = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
        routes.push(...getAppRoutes(path.join(dir, entry.name), baseRoute));
      } else {
        routes.push(...getAppRoutes(path.join(dir, entry.name), `${baseRoute}/${entry.name}`));
      }
    } else if (entry.name === 'page.tsx' || entry.name === 'page.jsx' || entry.name === 'page.js') {
      routes.push(baseRoute === '' ? '/' : baseRoute);
    }
  }
  return routes;
}

const existingRoutes = new Set(getAppRoutes(appDir));
console.log('Total app pages found:', existingRoutes.size);

function scanDir(dir) {
  let broken = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        broken.push(...scanDir(fullPath));
      }
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const linkRegex = /href=["'](\/[^"']*)["']/g;
      let match;
      while ((match = linkRegex.exec(content)) !== null) {
        const link = match[1].split('?')[0].split('#')[0];
        // Skip dynamic route templates like /portal/parent/${...} or /students/${...}
        if (link.includes('${') || link.includes(':')) continue;
        if (!existingRoutes.has(link) && !existingRoutes.has(link.replace(/\/$/, ''))) {
          // Check if there is a dynamic folder matching
          const parts = link.split('/').filter(Boolean);
          let isDynamicMatch = false;
          for (const route of existingRoutes) {
            const rParts = route.split('/').filter(Boolean);
            if (rParts.length === parts.length) {
              const matches = rParts.every((p, idx) => p.startsWith('[') || p === parts[idx]);
              if (matches) {
                isDynamicMatch = true;
                break;
              }
            }
          }
          if (!isDynamicMatch) {
            broken.push({ file: path.relative(path.join(__dirname, '..'), fullPath), link });
          }
        }
      }
    }
  }
  return broken;
}

const broken = scanDir(path.join(__dirname, '..', 'src'));
console.log('\nBroken internal links found:');
if (broken.length === 0) {
  console.log('✅ None! All internal links match valid routes.');
} else {
  for (const b of broken) {
    console.log(`❌ In ${b.file}: "${b.link}"`);
  }
}
