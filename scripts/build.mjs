// Web 版の配信用に、公開するファイルだけを dist/ にコピーする（wrangler dev / deploy の前に自動で走る）
import {rmSync,mkdirSync,cpSync,readdirSync} from 'node:fs';

const out='dist';
rmSync(out,{recursive:true,force:true});
mkdirSync(out+'/assets/tonpei',{recursive:true});
cpSync('index.html',out+'/index.html');
cpSync('css',out+'/css',{recursive:true});
cpSync('js',out+'/js',{recursive:true});
for(const f of readdirSync('assets/tonpei'))if(f.endsWith('.png'))cpSync('assets/tonpei/'+f,out+'/assets/tonpei/'+f);
