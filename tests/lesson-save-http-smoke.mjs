// Isolated admin-fixture only; exercises the real Next Server Action boundary.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServerClient } from '@supabase/ssr';
const dir = resolve(process.argv[2] || '.');
assert.ok(dir.startsWith(join(tmpdir(), 'amp-learn-admin-qa-')));
const base = 'http://localhost:4300';
const id = '00000000-0000-4000-8000-000000000020';
const cookies = new Map();
const db = createServerClient('http://127.0.0.1:4301', 'fixture-public-key', { cookies: {
 getAll: () => [...cookies].map(([name,value])=>({name,value})),
 setAll: values => values.forEach(({name,value})=>cookies.set(name,value)),
}});
assert.ifError((await db.auth.signInWithPassword({email:'qa@example.test',password:'FixtureOnly123!'})).error);
const cookie = [...cookies].map(([name,value])=>`${name}=${value}`).join('; ');
const path = `/hr/admin/lessons/${id}`;
await (await fetch(base+path, {headers:{cookie}})).text();
const manifest = JSON.parse(await readFile(join(dir,'.next/dev/server/server-reference-manifest.json'),'utf8'));
const action = Object.entries(manifest.node).find(([,entry])=>entry.exportedName==='saveLesson')?.[0];
assert.ok(action);
const paragraph = text => ({type:'paragraph',content:[{type:'text',text}]});
const content = {type:'doc',content:[
 {type:'paragraph',content:[{type:'text',text:'Na ovom '},{type:'text',marks:[{type:'link',attrs:{href:'https://docs.google.com/document/d/19jsj9Voy-OjZp7lEt94FuHcTH6RRYhY8tMgZra8YPh8/edit?usp=sharing',target:'_blank',rel:'noopener noreferrer nofollow',class:null,title:null}}],text:'linku'},{type:'text',text:' se nalazi blog post koji moraš objaviti na stranici. '}]},
 paragraph('Napravi blog post prema uputama u dokumentu. '),
 paragraph('Fotografije: Sve potrebne fotografije nalaze se u privitku ove lekcije.'),
 paragraph('VAŽNO: Ispred naslova blog posta u WordPress-u dodaj inicijale svoga imena npr. AMP_Vikend u Ljubljani: što vidjeti i kako isplanirati 2 dana'),
 {type:'paragraph'},
]};
const row = (await db.from('lessons').select('*').eq('id',id).single()).data;
const response = await fetch(base+path,{method:'POST',headers:{'Next-Action':action,'Content-Type':'text/plain;charset=UTF-8',origin:base,cookie},body:JSON.stringify(['hr',id,{title:row.title,status:row.status,video:'',content,version:row.updated_at}])});
const result = await response.text();
assert.match(result,/"updated_at"/);
assert.doesNotMatch(result,/"error":"(?:invalidDocument|documentTooLarge|invalidDocumentLink|failed|saveConflict)"/);
const saved = (await db.from('lessons').select('*').eq('id',id).single()).data.content;
assert.equal(saved.content[0].content[1].marks[0].attrs.href,content.content[0].content[1].marks[0].attrs.href);
assert.equal(saved.content[3].content[0].text,content.content[3].content[0].text);
console.log('Reported lesson content saved through the real Next Server Action; simulated provider only.');
