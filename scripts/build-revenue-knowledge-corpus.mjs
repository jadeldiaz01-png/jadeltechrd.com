import {readFile,mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";

const config=JSON.parse(await readFile("config/ai-knowledge-index-2026.json","utf8"));
const sourceSha=process.env.GITHUB_SHA||process.env.SOURCE_SHA||"";
if(!/^[a-f0-9]{40}$/i.test(sourceSha)) throw new Error("SOURCE_SHA_REQUIRED");

function normalize(text){
  return text.replace(/\r/g,"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g," ").trim();
}
function chunks(text,size=1000){
  const out=[];
  for(let i=0;i<text.length;i+=size){
    const part=text.slice(i,i+size).trim();
    if(part) out.push(part);
  }
  return out;
}
const sha256=(text)=>createHash("sha256").update(text).digest("hex");
const banned=/(sk-[A-Za-z0-9_-]{20,}|-----BEGIN (RSA )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._-]{20,})/i;

const records=[];
for(const path of config.approved_sources){
  const raw=normalize(await readFile(path,"utf8"));
  if(banned.test(raw)) throw new Error("SECRET_PATTERN_IN_APPROVED_CORPUS:"+path);
  const revision=sha256(raw);
  chunks(raw).forEach((text,index)=>{
    records.push({
      id:sha256(path+"\n"+revision+"\n"+index),
      namespace:config.namespace,
      text,
      metadata:{
        source:path,
        revision,
        trust:"APPROVED",
        active:true,
        doc_type:path.endsWith(".json")?"contract":"documentation",
        effective_epoch:0
      }
    });
  });
}
await mkdir("evidence",{recursive:true});
const artifact={
  schema:"jadel.ai.knowledge-corpus.v1",
  source_sha:sourceSha.toLowerCase(),
  generated_at:new Date().toISOString(),
  network_write_performed:false,
  vector_count:records.length,
  records
};
await writeFile("evidence/ai-knowledge-corpus.json",JSON.stringify(artifact,null,2));
console.log("KNOWLEDGE_CORPUS=PASS vectors="+records.length+" network_write=NO");
