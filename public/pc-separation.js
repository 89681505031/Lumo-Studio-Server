async function separateOnPC(){
 if(activeJob)return toast('Дождитесь завершения обработки');
 const original=tracks[Number($('#sourceTrack').value)],model=$('#separationModel').value;
 if(!original)return;
 let base;try{base=new URL($('#pcSeparatorUrl').value.trim());if(base.protocol!=='http:'||!['127.0.0.1','localhost'].includes(base.hostname))throw Error('Используйте http://127.0.0.1:7865 на этом ПК');}catch(e){toast(e.message);return}
 const key=$('#pcSeparatorKey').value.trim();if(!key){$('#separationDialog').close();$('#config').showModal();toast('Запустите Start.cmd и вставьте ключ ПК');return}
 const headers={Authorization:'Bearer '+key};let job;
 try{
  const health=await fetch(new URL('/health',base),{headers,signal:AbortSignal.timeout(10000)});if(!health.ok)throw Error('Проверьте ключ и окно Start.cmd');
  $('#separationDialog').close();stop(false);job=beginJob('Demucs на вашем ПК');jobProgress({stage:'Подготовка WAV для ПК',progress:0});
  const duration=original.buffer.duration-original.trimStart-original.trimEnd;
  if(duration<=0||duration>900)throw Error('Выберите фрагмент до 15 минут');
  const ac=new OfflineAudioContext(2,Math.ceil(duration*44100),44100),src=ac.createBufferSource();src.buffer=original.buffer;src.connect(ac.destination);src.start(0,original.trimStart,duration);const prepared=await ac.startRendering();
  if(job.cancelled)return;
  jobProgress({stage:'Demucs разделяет на ПК. Первое скачивание модели может занять время.',progress:0});
  const r=await fetch(new URL('/separate?model='+model,base),{method:'POST',headers:{...headers,'Content-Type':'audio/wav'},body:wav(prepared),signal:AbortSignal.timeout(1900000)});const result=await r.json();if(!r.ok)throw Error(result.error||'Ошибка ПК');
  if(job.cancelled)return;
  const expected=model==='htdemucs_6s'?6:4;if(!Array.isArray(result.stems)||result.stems.length!==expected)throw Error('Неполные дорожки');
  const labels={vocals:'Вокал',drums:'Ударные',bass:'Бас',other:'Остальные инструменты',guitar:'Гитара',piano:'Пианино'},ready=[];
  for(const stem of result.stems){const url=new URL(stem.url,base);if(url.origin!==base.origin||!labels[stem.name])throw Error('Неверный ответ ПК');const f=await fetch(url,{headers});if(!f.ok)throw Error('Не удалось скачать '+stem.name);ready.push({name:labels[stem.name],role:stem.name==='vocals'?'vocal':'instrumental',buffer:await audio().decodeAudioData(await f.arrayBuffer())})}
  if(job.cancelled)return;if(!tracks.includes(original))throw Error('Исходная дорожка удалена');
  for(const stem of ready)addTrack(stem.name+' · '+original.name,stem.buffer,{role:stem.role,start:original.start,gain:original.gain});original.mute=true;render();message('bot','Demucs добавил '+expected+' отдельных дорожек. Исходная песня отключена. Прослушайте артефакты, особенно гитару и пианино.');
 }catch(e){if(!job?.cancelled)message('bot','Разделение на ПК не выполнено: '+e.message+'. Запустите Start.cmd на этом же компьютере и разрешите браузеру доступ к локальной сети.');}finally{if(job&&activeJob===job)endJob()}
}
$('#runSeparation').onclick=()=>$('#separationModel').value.startsWith('htdemucs')?separateOnPC():separateOnDevice();
