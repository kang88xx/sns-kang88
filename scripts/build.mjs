import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createPhotoCloud} from '../photos.js';
const files=['index.html','styles.css','app.js','core.js','store.js','seed.js','favicon.svg','photos.js','photo-ui.js'];
const config={url:process.env.SUPABASE_URL?.trim()||'',publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY?.trim()||''};
if ((config.url || config.publishableKey) && !createPhotoCloud(config).configured) {
  throw new Error('Set a valid Supabase project URL and public publishable/anon key. Secret keys must never enter this static build.');
}
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await Promise.all(files.map(async file=>writeFile(`dist/${file}`,await readFile(file))));
await writeFile('dist/cloud-config.js',`export const CLOUD_CONFIG = ${JSON.stringify(config)};\n`);
console.log(`Built ${files.length+1} static files into dist/ (photos ${config.url?'configured':'awaiting setup'})`);
