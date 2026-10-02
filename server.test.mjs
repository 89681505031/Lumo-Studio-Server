import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,sanitize} from './server.mjs';
test('drops invalid actions and clamps values',()=>{assert.deepEqual(sanitize({reply:'ok',actions:[{trackId:1,parameter:'gain',value:999},{trackId:99,parameter:'gain',value:2},{trackId:1,parameter:'mute',value:1},{trackId:1,parameter:'pan',value:NaN}]},[{id:1}]),{reply:'ok',actions:[{trackId:1,parameter:'gain',value:6}]});});
test('requires secret route and origin, keeps provider key server side',async()=>{
 let providerCall;
 const server=createServer({GROQ_API_KEY:'test-key',STUDIO_TOKEN:'test-token-long-enough-for-security',STUDIO_ORIGIN:'https://studio.example'},async(url,opts)=>{providerCall={url,opts};return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({reply:'Готово',actions:[{trackId:1,parameter:'gain',value:2}]})}}]}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(base+'/health')).status,200);
  assert.equal((await fetch(base+'/chat',{method:'POST'})).status,404);
  const route=base+'/s/test-token-long-enough-for-security/chat';
  assert.equal((await fetch(route,{method:'POST'})).status,403);
  const pre=await fetch(route,{method:'OPTIONS',headers:{Origin:'https://studio.example'}});assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),'https://studio.example');
  const result=await fetch(route,{method:'POST',headers:{Origin:'https://studio.example','Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'громче'}],tracks:[{id:1,name:'Вокал',gain:0,secret:'discard'}],selected:0})});
  assert.equal(result.status,200);assert.deepEqual(await result.json(),{reply:'Готово',actions:[{trackId:1,parameter:'gain',value:2}]});
  assert.equal(providerCall.opts.headers.Authorization,'Bearer test-key');assert.ok(!providerCall.opts.body.includes('discard'));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
