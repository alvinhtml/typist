import type { CsvKind, Pair } from '../shared/contracts';
export function parseCsv(bytes:Uint8Array,kind:CsvKind){
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('文件必须为有效 UTF-8。');}
  const rows:{cells:string[];line:number}[]=[];let cells:string[]=[],cell='',quoted=false,closed=false,line=1,start=1;
  const field=()=>{cells.push(cell);cell='';closed=false;};
  const row=()=>{field();if(cells.some(c=>c.trim()))rows.push({cells,line:start});cells=[];start=line+1;};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else{cell+=c;if(c==='\n')line++;}continue;}
    if(c===','){field();continue;}
    if(c==='\n'||c==='\r'){row();if(c==='\r'&&text[i+1]==='\n')i++;line++;continue;}
    if(closed)throw new Error(`第 ${line} 行引号后存在非法字符。`);
    if(c==='"'){if(cell)throw new Error(`第 ${line} 行引号格式错误。`);quoted=true;}else cell+=c;
  }
  if(quoted)throw new Error('CSV 引号未闭合。');if(cell||cells.length||closed)row();
  const header=rows.shift()?.cells;const required=kind==='supplemental'?['word','code','level']:['word','code'];
  if(!header||required.some(k=>header.filter(c=>c===k).length!==1))throw new Error(`缺少或重复必要列：${required.join(',')}。`);
  return rows.map(r=>({line:r.line,word:r.cells[header.indexOf('word')]??'',code:r.cells[header.indexOf('code')]??'',level:r.cells[header.indexOf('level')]??''}));
}
export function serializeCsv(kind:CsvKind,rows:(Pair&{level?:number})[]){const keys=kind==='supplemental'?['word','code','level'] as const:['word','code'] as const;const escape=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`;return '\ufeff'+keys.join(',')+'\r\n'+rows.map(r=>keys.map(k=>escape(r[k])).join(',')).join('\r\n')+(rows.length?'\r\n':'');}
