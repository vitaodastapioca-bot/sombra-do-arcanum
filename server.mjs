import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';

const here=path.dirname(fileURLToPath(import.meta.url));
const dbPath=process.env.DATABASE_FILE||path.join(here,'data','fichas.json');
const port=Number(process.env.PORT||3000);
const maxBody=850*1024;
const baseAttrs=Array.from({length:20},(_,i)=>i===5||i===19?50:0);
const baseResources=[120,50,50,100];
const sessions=new Map();

function problem(res,status,message){return response(res,status,{error:message})}
function response(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))}
function goodUInt(v){return Number.isSafeInteger(v)&&v>=0}
function isString(v,max=50000){return typeof v==='string'&&v.length<=max}
function validate(d){
 if(!d||typeof d!=='object')return 'Ficha ausente';
 if(!Array.isArray(d.attrs)||d.attrs.length!==20||!d.attrs.every(goodUInt))return 'Atributos devem ser inteiros não negativos';
 if(d.portrait!==undefined&&d.portrait!==''&&!(typeof d.portrait==='string'&&d.portrait.length<=300000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(d.portrait)))return 'Formato ou tamanho de retrato inválido';
 if(!Array.isArray(d.resources)||d.resources.length!==4)return 'Recursos incompletos';
 for(let i=0;i<4;i++){
  const r=d.resources[i];
  if(!r||!goodUInt(r.invest)||!goodUInt(r.current)||r.current>baseResources[i]+r.invest)return 'Recursos inválidos ou acima do máximo';
 }
 if(!['none','with'].includes(d.classMode))return 'Modo de classe inválido';
 if(!goodUInt(d.level)||d.level<1||d.level>100000)return 'Nível inválido';
 if(!goodUInt(d.extra)||d.extra>1e7)return 'Pontos extras inválidos';
 if(!goodUInt(d.xp)||!goodUInt(d.xpTarget)||d.xpTarget<1)return 'XP inválido';
 if(!d.fields||typeof d.fields!=='object')return 'Identidade ausente';
 for(const [k,v] of Object.entries(d.fields)){
  if(!isString(v))return 'Campo de ficha inválido';
 }
 if(!isString(d.fields.name,100)||!d.fields.name.trim())return 'Preencha nome do personagem';
 if(!isString(d.fields.phobia,200)||!d.fields.phobia.trim())return 'Informe uma fobia';
 if(d.classMode==='with'&&(!isString(d.fields.className,100)||!d.fields.className.trim()))return 'Informe a classe escolhida';
 if(!goodUInt(Number(d.fields.load||0))||Number(d.fields.load||0)>baseAttrs[19]+d.attrs[19])return 'Peso carregado acima da capacidade';
 const spent=d.attrs.reduce((x,y)=>x+y,0)+d.resources.reduce((x,y)=>x+y.invest,0);
 const budget=(d.classMode==='with'?1800:1600)+(d.level-1)*250+d.extra;
 if(!Number.isSafeInteger(spent)||spent>budget)return 'Pontos ultrapassam o limite disponível';
 return null;
}
function db(){try{let d=JSON.parse(fs.readFileSync(dbPath,'utf8'));return Array.isArray(d)?d:[]}catch(e){if(e.code==='ENOENT')return [];throw e}}
function saveDb(rows){fs.mkdirSync(path.dirname(dbPath),{recursive:true,mode:0o700});const tmp=dbPath+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(rows,null,2),{mode:0o600});fs.renameSync(tmp,dbPath)}
function hash(password,salt){return scryptSync(password,salt,64).toString('hex')}
function verify(password,row){if(typeof password!=='string'||password.length<6||password.length>200)return false;const hashGot=Buffer.from(hash(password,row.salt),'hex'),stored=Buffer.from(row.hash,'hex');return hashGot.length===stored.length&&timingSafeEqual(hashGot,stored)}
function waitLimit(ip){const now=Date.now(),current=sessions.get(ip)||[];const recent=current.filter(t=>t>now-60000);recent.push(now);sessions.set(ip,recent);if(sessions.size>2000){for(const [k,v] of sessions){if(v.every(t=>t<now-60000))sessions.delete(k)}}return recent.length>20}
async function readBody(req){let raw='',length=0;for await(const chunk of req){length+=chunk.length;if(length>maxBody)throw new Error('Ficha excede o tamanho permitido');raw+=chunk.toString('utf8')}try{return JSON.parse(raw)}catch{throw new Error('JSON inválido')}}
const html=fs.readFileSync(path.join(here,'index.html'),'utf8');
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html')){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});res.end(html);return;
  }
  if(req.method==='GET'&&url.pathname==='/api/health')return response(res,200,{service:'sombra-arcanum',version:9});
  if(req.method==='GET'&&url.pathname==='/api/sheets')return response(res,200,db().map(r=>({id:r.id,name:r.name,portrait:typeof r.data?.portrait==='string'?r.data.portrait:''})));
  const parts=/^\/api\/sheets\/([0-9a-f-]{36})\/(unlock|save)$/.exec(url.pathname);
  if(req.method==='POST'&&(url.pathname==='/api/sheets'||parts)){
   const ip=req.socket.remoteAddress||'unknown';if(waitLimit(ip))return problem(res,429,'Muitas tentativas. Tente novamente em um minuto.');
   let body;try{body=await readBody(req)}catch(e){return problem(res,400,e.message)}
   if(url.pathname==='/api/sheets'){
    const err=validate(body.data);if(err)return problem(res,400,err);
    if(typeof body.password!=='string'||body.password.length<6||body.password.length>200)return problem(res,400,'A senha precisa ter entre 6 e 200 caracteres');
    const rows=db(),id=randomUUID(),salt=randomBytes(16).toString('hex');
    rows.push({id,name:body.data.fields.name.trim(),salt,hash:hash(body.password,salt),data:body.data,createdAt:new Date().toISOString()});saveDb(rows);return response(res,201,{id});
   }
   const [_,id,action]=parts,row=db().find(r=>r.id===id);
   if(!row||!verify(body.password,row))return problem(res,401,'Ficha não encontrada ou senha incorreta');
   if(action==='unlock')return response(res,200,{data:row.data});
   const err=validate(body.data);if(err)return problem(res,400,err);
   const rows=db(),index=rows.findIndex(r=>r.id===id);rows[index].data=body.data;rows[index].name=body.data.fields.name.trim();rows[index].updatedAt=new Date().toISOString();saveDb(rows);return response(res,200,{ok:true});
  }
  return problem(res,404,'Página não encontrada');
 }catch(e){console.error('Server error:',e);return problem(res,500,'Erro interno no servidor')}
});
server.listen(port,'0.0.0.0',()=>console.log(`Sombra do Arcanum V9 disponível na porta ${port}`));
