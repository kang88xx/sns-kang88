import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
const files=['index.html','styles.css','app.js','core.js','store.js','seed.js','favicon.svg'];
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await Promise.all(files.map(async file=>writeFile(`dist/${file}`,await readFile(file))));
console.log(`Built ${files.length} static files into dist/`);
