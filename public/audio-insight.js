(function(root){
const db=x=>Math.max(-120,20*Math.log10(Math.max(x,1e-6)));
function measure(buffer,trimStart=0,trimEnd=0){
 const rate=buffer.sampleRate,start=Math.max(0,Math.floor(trimStart*rate)),end=Math.max(start,Math.min(buffer.length,Math.floor((buffer.duration-trimEnd)*rate))),length=end-start;
 if(!length) return {version:1,source:'raw trimmed audio',error:'Empty clip'};
 const span=Math.min(length,Math.floor(rate*20)),starts=length<=span?[start]:[start,start+Math.floor((length-span)/2),end-span];
 let count=0,sum=0,peak=0,clipped=0,silent=0,crossings=0,lowEnergy=0,midEnergy=0,highEnergy=0,xy=0,xx=0,yy=0;
 const chans=Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c)),aLow=1-Math.exp(-2*Math.PI*200/rate),aHigh=1-Math.exp(-2*Math.PI*4000/rate);
 let previousEnd=-1;
 for(const pos of starts){const from=Math.max(pos,previousEnd),to=Math.min(end,pos+span);if(from>=to)continue;previousEnd=to;let l=0,h=0,prev=0;
  for(let i=from;i<to;i++){let mono=0;for(const data of chans){const v=data[i];if(!Number.isFinite(v))return {version:1,error:'Invalid audio samples'};const abs=Math.abs(v);peak=Math.max(peak,abs);sum+=v*v;clipped+=abs>=.999?1:0;silent+=abs<.001?1:0;count++;mono+=v/chans.length}l+=aLow*(mono-l);h+=aHigh*(mono-h);lowEnergy+=l*l;midEnergy+=(h-l)**2;highEnergy+=(mono-h)**2;if(i>from&&mono*prev<0)crossings++;prev=mono;if(chans.length>=2){xy+=chans[0][i]*chans[1][i];xx+=chans[0][i]**2;yy+=chans[1][i]**2}}
 }
 const rms=Math.sqrt(sum/count),energy=lowEnergy+midEnergy+highEnergy,round=x=>Math.round(x*100)/100;
 return {version:1,source:'raw trimmed audio before effects',sampleRate:rate,channels:chans.length,clipSeconds:round(length/rate),analyzedSeconds:round(count/chans.length/rate),sampling:'up to 20 seconds at start, middle and end; overlapping samples counted once',peakDbfs:round(db(peak)),rmsDbfs:round(db(rms)),crestDb:round(db(peak)-db(rms)),nearFullScalePercent:round(100*clipped/count),quietSamplePercent:round(100*silent/count),approximateBandEnergyPercent:{below200Hz:round(100*lowEnergy/(energy||1)),from200To4000Hz:round(100*midEnergy/(energy||1)),above4000Hz:round(100*highEnergy/(energy||1))},stereoCorrelation:chans.length>=2?round(xy/Math.sqrt(xx*yy||1)):null,limitations:'Sample peaks, not true peak or LUFS. Approximate bands from first-order filters. No transcription, instrument recognition, noise diagnosis or pitch analysis.'};
}
root.lumoAudioInsight={measure};
})(typeof window==='undefined'?globalThis:window);
