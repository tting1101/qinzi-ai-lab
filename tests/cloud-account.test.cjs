"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { createHash, randomUUID } = require("node:crypto");
const { FileStore, SupabaseStore, cloudConfiguration, createStore } = require("../lib/account-store");
const { loadLocalCloud } = require("../lib/local-cloud-config");
const { handleRequest, passwordHash } = require("../server");

const fixtures = [];
const fixtureParent = "E:/my-first-website-资料";
function localStore() {
  const directory = fs.mkdtempSync(path.join(fixtureParent, "qinzi-account-test-"));
  fixtures.push(directory);
  return { store: new FileStore(directory), directory };
}
test.after(() => {
  for (const directory of fixtures) {
    // These exact fresh test folders contain synthetic data only, never Owner files.
    assert.equal(path.resolve(path.dirname(directory)), path.resolve(fixtureParent));
    assert.ok(path.basename(directory).startsWith("qinzi-account-test-"));
    fs.rmSync(directory, { recursive: true });
  }
});

async function request(store, route, { method = "GET", data, cookie, origin = "http://127.0.0.1:3000", requestOrigin = origin, parsed = false, raw, host } = {}) {
  const input = raw ?? (data === undefined ? "" : JSON.stringify(data));
  const req = Readable.from([Buffer.from(input)]);
  req.method = method;
  req.url = route;
  req.headers = { host: host || new URL(origin).host, origin: requestOrigin, "content-type": "application/json", ...(cookie ? { cookie } : {}) };
  if (parsed) req.body = data;
  const result = { headers: {} };
  const res = {
    headersSent: false,
    setHeader(key, value) { result.headers[key.toLowerCase()] = value; },
    writeHead(status, headers) { result.status = status; this.headersSent = true; for (const [key,value] of Object.entries(headers)) this.setHeader(key, value); },
    end(text) {
      result.text = String(text ?? "");
      if ((result.headers["content-type"] || "").startsWith("application/json")) result.body = JSON.parse(result.text);
    },
    destroy() { result.destroyed = true; },
  };
  await handleRequest(req, res, { store, origin });
  return result;
}
const cookieFrom = result => result.headers["set-cookie"]?.split(";", 1)[0];
const identity = { username: "synthetic_star", password: "synthetic-only-good-password" };

test("register/login/refresh/logout and login again preserve original account semantics", async () => {
  const {store,directory}=localStore();
  const registration=await request(store,"/api/register",{method:"POST",data:identity});
  assert.equal(registration.status,201);
  const saved=JSON.parse(fs.readFileSync(path.join(directory,"users.json"),"utf8"))[0];
  assert.match(saved.salt,/^[a-f0-9]{32}$/);
  assert.match(saved.passwordHash,/^[a-f0-9]{128}$/);
  assert.equal(saved.password,undefined);
  assert.ok(!JSON.stringify(saved).includes(identity.password));
  const login=await request(store,"/api/login",{method:"POST",data:identity});
  assert.equal(login.status,200);
  const cookie=cookieFrom(login);
  assert.match(cookie,/^qinzi_local_session=[a-f0-9]{64}$/);
  assert.match(login.headers["set-cookie"],/HttpOnly; SameSite=Strict/);
  const session=JSON.parse(fs.readFileSync(path.join(directory,"sessions.json"),"utf8"))[0];
  assert.equal(session.tokenHash,createHash("sha256").update(cookie.split("=")[1]).digest("hex"));
  assert.deepEqual(Object.keys(session).sort(),["expiresAt","tokenHash","userId"]);
  assert.ok(!JSON.stringify(session).includes(cookie.split("=")[1]));
  assert.equal((await request(store,"/api/me",{cookie})).body.username,identity.username);
  assert.equal((await request(new FileStore(directory),"/api/me",{cookie})).body.username,identity.username);
  const logout=await request(store,"/api/logout",{method:"POST",cookie});
  assert.equal(logout.status,200);
  assert.match(logout.headers["set-cookie"],/Max-Age=0/);
  assert.equal((await request(store,"/api/me",{cookie})).body.username,null);
  assert.equal((await request(store,"/api/login",{method:"POST",data:identity})).status,200);
});

test("each registration gets its own salt and case-insensitive duplicates are rejected",async()=>{
  const {store}=localStore();
  await request(store,"/api/register",{method:"POST",data:identity});
  await request(store,"/api/register",{method:"POST",data:{...identity,username:"another_star"}});
  assert.notEqual(store.findUser(identity.username).salt,store.findUser("another_star").salt);
  assert.equal((await request(store,"/api/register",{method:"POST",data:{...identity,username:identity.username.toUpperCase()}})).status,409);
});

test("wrong password/unknown user are rejected without creating any session",async()=>{
  const {store,directory}=localStore();
  await request(store,"/api/register",{method:"POST",data:identity});
  assert.equal((await request(store,"/api/login",{method:"POST",data:{...identity,password:"wrong-password"}})).status,401);
  assert.equal((await request(store,"/api/login",{method:"POST",data:{...identity,username:"not_registered"}})).status,401);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,"sessions.json"),"utf8")).length,0);
});

test("relogin rotates token; expired token and old token cannot authenticate",async()=>{
  const {store}=localStore();
  await request(store,"/api/register",{method:"POST",data:identity});
  const first=await request(store,"/api/login",{method:"POST",data:identity});
  const second=await request(store,"/api/login",{method:"POST",data:identity,cookie:cookieFrom(first)});
  assert.notEqual(cookieFrom(first),cookieFrom(second));
  assert.equal((await request(store,"/api/me",{cookie:cookieFrom(first)})).body.username,null);
  const session=store.getSession(createHash("sha256").update(cookieFrom(second).split("=")[1]).digest("hex"));
  store.write("sessions.json",[{...session,expiresAt:Date.now()-1}]);
  assert.equal((await request(store,"/api/me",{cookie:cookieFrom(second)})).body.username,null);
});

test("legacy JSON hashes still authenticate without rehashing or clearing old data",async()=>{
  const {store}=localStore();
  const salt="0123456789abcdef0123456789abcdef";
  const legacy={id:randomUUID(),username:identity.username,salt,passwordHash:passwordHash(identity.password,salt).toString("hex")};
  store.write("users.json",[legacy]);
  assert.equal((await request(store,"/api/login",{method:"POST",data:identity})).status,200);
  assert.deepEqual(store.read("users.json"),[legacy]);
});

test("HTTPS deployment cookies are Secure; wrong Host and cross-origin posts are blocked",async()=>{
  const {store}=localStore();const origin="https://qinzi-ai-lab.vercel.app";
  await request(store,"/api/register",{method:"POST",data:identity,origin});
  const login=await request(store,"/api/login",{method:"POST",data:identity,origin});
  assert.equal(login.status,200);assert.match(login.headers["set-cookie"],/; Secure$/);
  assert.equal((await request(store,"/api/login",{method:"POST",data:identity,origin,requestOrigin:"https://untrusted.invalid"})).status,403);
  assert.equal((await request(store,"/api/me",{origin,host:"untrusted.invalid"})).status,403);
});

test("streamed and Vercel-parsed JSON bodies work; oversized and invalid input is rejected",async()=>{
  const {store}=localStore();
  assert.equal((await request(store,"/api/register",{method:"POST",data:identity,parsed:true})).status,201);
  assert.equal((await request(store,"/api/register",{method:"POST",raw:"{broken"})).status,400);
  assert.equal((await request(store,"/api/login",{method:"POST",data:{...identity,password:"x".repeat(5000)},parsed:true})).status,400);
  assert.equal((await request(store,"/api/register",{method:"POST",data:{...identity,username:"<script>"}})).status,400);
});

test("private account files and unknown endpoints cannot be downloaded",async()=>{
  const {store}=localStore();
  for(const route of ["/data/users.json","/data/sessions.json","/.env.local","/api/unknown","/server.js","/supabase/schema.sql"]){
    assert.equal((await request(store,route)).status,404,route);
  }
});

const fakeEnv={DATA_BACKEND:"supabase",SUPABASE_URL:"https://mklnxuvejrjiqbxadhus.supabase.co",SUPABASE_SECRET_KEY:"sb_secret_"+"A".repeat(32)};
test("cloud guard rejects missing, public, whitespace, control and hidden-character keys",()=>{
  for(const key of [undefined,"","sb_publishable_"+"A".repeat(32),fakeEnv.SUPABASE_SECRET_KEY+"\n",fakeEnv.SUPABASE_SECRET_KEY+" ",fakeEnv.SUPABASE_SECRET_KEY+"\u200b"]){
    assert.throws(()=>cloudConfiguration({...fakeEnv,SUPABASE_SECRET_KEY:key}));
  }
  assert.throws(()=>cloudConfiguration({...fakeEnv,SUPABASE_URL:"http://untrusted.invalid"}));
});

test("explicit local config ignores poisoned inherited environment and never falls back",()=>{
  const {directory}=localStore();
  assert.throws(()=>loadLocalCloud(directory));
  fs.writeFileSync(path.join(directory,".env.local"),`DATA_BACKEND=supabase\nSUPABASE_URL=${fakeEnv.SUPABASE_URL}\nSUPABASE_SECRET_KEY=${fakeEnv.SUPABASE_SECRET_KEY}\n`);
  const old=process.env.SUPABASE_SECRET_KEY;process.env.SUPABASE_SECRET_KEY="poisoned-process-value\n";
  try{assert.equal(loadLocalCloud(directory).SUPABASE_SECRET_KEY,fakeEnv.SUPABASE_SECRET_KEY);}
  finally{if(old===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=old;}
  assert.throws(()=>createStore({env:{...fakeEnv,SUPABASE_SECRET_KEY:undefined},directory}));
  assert.throws(()=>createStore({env:{VERCEL:"1",DATA_BACKEND:"file"},directory}));
});

test("official REST transport uses apikey, preserves hash mappings, and checks tables with zero rows",async()=>{
  const requests=[];const id=randomUUID();
  const transport=async(url,options)=>{
    requests.push({url,options});
    return {ok:true,status:200,json:async()=>url.searchParams.get("limit")==="0"?[]:[{id,username:identity.username,salt:"a".repeat(32),password_hash:"b".repeat(128)}]};
  };
  const store=new SupabaseStore(fakeEnv,transport);
  assert.equal((await store.findUser(identity.username)).passwordHash,"b".repeat(128));
  await store.createUser({id,username:identity.username,salt:"a".repeat(32),passwordHash:"b".repeat(128)});
  await store.createSession({tokenHash:"c".repeat(64),userId:id,expiresAt:Date.now()+10000});
  await store.check();
  assert.ok(requests.every(item=>item.options.headers.apikey===fakeEnv.SUPABASE_SECRET_KEY&&item.options.headers.Authorization===undefined));
  assert.equal(requests[0].url.searchParams.get("username_key"),`eq.${identity.username.toLowerCase()}`);
  assert.equal(JSON.parse(requests[1].options.body).password_hash,"b".repeat(128));
  assert.equal(JSON.parse(requests[2].options.body).token_hash,"c".repeat(64));
  assert.ok(requests.slice(-2).every(item=>item.url.searchParams.get("limit")==="0"));
});

test("cloud errors and uncertain responses stop without retry, secret echo, or file fallback",async()=>{
  let sent=0;
  const store=new SupabaseStore(fakeEnv,async()=>{sent++;throw new Error(fakeEnv.SUPABASE_SECRET_KEY);});
  const result=await request(store,"/api/login",{method:"POST",data:identity});
  assert.equal(result.status,503);assert.equal(sent,1);assert.equal(result.headers["set-cookie"],undefined);
  assert.ok(!result.text.includes(fakeEnv.SUPABASE_SECRET_KEY));
  const duplicate=new SupabaseStore(fakeEnv,async()=>({ok:false,status:409}));
  await assert.rejects(duplicate.createUser({id:randomUUID(),username:identity.username,salt:"a".repeat(32),passwordHash:"b".repeat(128)}),error=>error.code==="DUPLICATE_USER");
});

test("cloud storage cannot be bypassed by an empty deployment configuration",async()=>{
  const cloudHandler=require("../lib/cloud-handler");const headers={};let status;
  const result={setHeader(k,v){headers[k]=v;},writeHead(value){status=value;},end(){}};
  const old=process.env.DATA_BACKEND;delete process.env.DATA_BACKEND;
  try{await cloudHandler({},result);assert.equal(status,503);}
  finally{if(old!==undefined)process.env.DATA_BACKEND=old;}
});
