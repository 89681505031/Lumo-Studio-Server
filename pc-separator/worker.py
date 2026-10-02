import os, sys, uuid, secrets, subprocess, threading, shutil
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
ROOT=Path(__file__).resolve().parent
KEY=ROOT/'access-key.txt'
if not KEY.exists(): KEY.write_text(secrets.token_hex(32),encoding='ascii')
TOKEN=KEY.read_text(encoding='ascii').strip()
JOBS=ROOT/'jobs'; JOBS.mkdir(exist_ok=True)
LOCK=threading.Lock()
ORIGINS={'https://lumo-studio-ai.onrender.com','https://lumo-recording-studio.alexpimenov98gg.chatgpt.site'}
import json
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def respond(self,code,data):
  raw=json.dumps(data).encode(); self.send_response(code); self.headers_out('application/json');self.end_headers();self.wfile.write(raw)
 def headers_out(self,mime):
  origin=self.headers.get('Origin','')
  if origin in ORIGINS: self.send_header('Access-Control-Allow-Origin',origin)
  self.send_header('Vary','Origin');self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
 def permitted(self):
  if self.headers.get('Origin') not in ORIGINS: self.respond(403,{'error':'Origin not allowed'});return False
  if not secrets.compare_digest(self.headers.get('Authorization',''),'Bearer '+TOKEN): self.respond(401,{'error':'Access key required'});return False
  return True
 def do_OPTIONS(self):
  if self.headers.get('Origin') not in ORIGINS:return self.respond(403,{'error':'Origin not allowed'})
  self.send_response(204);self.headers_out('application/json');self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Authorization, Content-Type');self.send_header('Access-Control-Allow-Private-Network','true');self.end_headers()
 def do_GET(self):
  if not self.permitted():return
  path=urlparse(self.path).path
  if path=='/health': return self.respond(200,{'status':'ok','models':['htdemucs','htdemucs_6s']})
  parts=path.strip('/').split('/')
  if len(parts)!=3 or parts[0]!='stems' or len(parts[1])!=32 or any(c not in '0123456789abcdef' for c in parts[1]) or parts[2] not in ['vocals','drums','bass','guitar','piano','other']:return self.respond(404,{'error':'Not found'})
  matches=list((JOBS/parts[1]/'output').glob('*/audio/'+parts[2]+'.wav'))
  if not matches:return self.respond(404,{'error':'Not found'})
  self.send_response(200);self.headers_out('audio/wav');self.end_headers()
  with matches[0].open('rb') as f: shutil.copyfileobj(f,self.wfile)
 def do_POST(self):
  if not self.permitted():return
  parsed=urlparse(self.path);model=parse_qs(parsed.query).get('model',['htdemucs_6s'])[0]
  if parsed.path!='/separate' or model not in ['htdemucs','htdemucs_6s']:return self.respond(400,{'error':'Invalid model'})
  try:size=int(self.headers.get('Content-Length','0'))
  except ValueError:return self.respond(400,{'error':'Invalid size'})
  if not 44<=size<=150*1024*1024:return self.respond(413,{'error':'WAV limit is 150 MB'})
  if not LOCK.acquire(blocking=False):return self.respond(429,{'error':'PC is busy'})
  job=uuid.uuid4().hex;folder=JOBS/job;folder.mkdir()
  try:
   # Delete only this application's earlier temporary jobs, after browser downloads have completed.
   for old in JOBS.iterdir():
    if old!=folder and old.is_dir():shutil.rmtree(old,ignore_errors=True)
   self.connection.settimeout(120)
   data=self.rfile.read(size)
   if len(data)!=size or data[:4]!=b'RIFF' or data[8:12]!=b'WAVE':return self.respond(400,{'error':'A WAV file is required'})
   audio=folder/'audio.wav';audio.write_bytes(data)
   print('Separating with',model,flush=True)
   result=subprocess.run([sys.executable,'-m','demucs','-n',model,'--device','cuda','--segment','5','--shifts','1','--float32','-o',str(folder/'output'),str(audio)],cwd=ROOT,timeout=1800)
   if result.returncode:raise RuntimeError('Demucs failed. Check the worker console.')
   names=['vocals','drums','bass','other']+(['guitar','piano'] if model=='htdemucs_6s' else [])
   for name in names:
    if not (folder/'output'/model/'audio'/(name+'.wav')).exists():raise RuntimeError('Missing stem '+name)
   self.respond(200,{'stems':[{'name':name,'url':'/stems/'+job+'/'+name} for name in names]})
  except Exception as e:
   self.respond(500,{'error':str(e)})
  finally: LOCK.release()
print('Lumo PC separator: http://127.0.0.1:7865',flush=True)
print('Access key (paste only into Lumo Studio settings): '+TOKEN,flush=True)
print('Keep this window open. Audio is processed on this PC. Ctrl+C stops the server.',flush=True)
ThreadingHTTPServer(('127.0.0.1',7865),Handler).serve_forever()
