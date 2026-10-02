import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const r=await fetch('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/ort-wasm-simd-threaded.wasm');
if(!r.ok)throw Error('Runtime download failed');
const b=Buffer.from(await r.arrayBuffer());
if(createHash('sha256').update(b).digest('hex')!=='ec8580a9d7b9476ceee52e10a7f94124e4dc71a019d666ed6d4726697c109a4d')throw Error('Runtime checksum mismatch');
await writeFile(new URL('./public/vendor/ort/ort-wasm-simd-threaded.wasm',import.meta.url),b);
