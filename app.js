import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.SUPABASE_CONFIG;
const db=cfg?.url&&cfg?.publishableKey?createClient(cfg.url,cfg.publishableKey):null;
const $=id=>document.getElementById(id);
const state={user:null,servers:[],room:null,channel:null,messages:[],authMode:"signin",botsEnabled:false,enabledBotIds:["greg","susan","nugget"],modelPipeline:null,modelPromise:null,modelProfile:null,botGenerating:false,modelStoragePersistent:null};
const BOT_META={greg:{name:"Greg",tagline:"Argumentative",avatar:"G",style:"Challenge assumptions, point out weak logic, and push back firmly without being rude."},susan:{name:"Susan",tagline:"Evidence focused",avatar:"S",style:"Reason carefully, ask for evidence, separate facts from opinions, and explain uncertainty."},nugget:{name:"Nugget Jr.",tagline:"Chaotic wildcard",avatar:"N",style:"Bring unexpected angles and playful energy, but still make a coherent argument."}};
let toastTimer;
function toast(s){const t=$("toast");t.textContent=s;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2800)}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function name(){return state.user?.user_metadata?.display_name||state.user?.email?.split("@")[0]||"Member"}
function auth(){if(!state.user){setAuthMode("signin");$("auth-dialog").showModal();return false}return true}
function setAuthMode(m){state.authMode=m;const up=m==="signup";$("auth-title").textContent=up?"Create your account":"Welcome back";$("auth-subtitle").textContent=up?"Pick a name and claim your seat.":"Sign in to join the discussion.";$("display-name-wrap").classList.toggle("hidden",!up);$("auth-submit").textContent=up?"Create account":"Sign in";$("auth-switch-copy").textContent=up?"Already have an account?":"New here?";$("auth-switch").textContent=up?"Sign in":"Create an account"}
function view(v){document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));$(v+"-view").classList.add("active");document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===v));$("breadcrumb").textContent=v==="room"?"YOUR SERVER / LIVE DISCUSSION":v==="my-servers"?"WORKSPACE / MY SERVERS":"DISCOVER / PUBLIC ROOMS"}
function card(s){const own=s.owner_id===state.user?.id;return '<article class="server-card" data-server="'+s.id+'"><div class="server-card-top"><div class="server-avatar">'+esc(s.name[0]||"N")+'</div><span class="server-tag">'+(own?"OWNER":"MEMBER")+'</span></div><h3>'+esc(s.name)+'</h3><p>'+esc(s.description||"A place for a good debate.")+'</p><div class="server-card-foot"><span>▦ Private server</span><span>Open room ↗</span></div></article>'}
function renderServers(){const html=state.servers.map(card).join("");$("server-grid").innerHTML=html||'<div class="empty-card"><h3>No rooms yet</h3><p>Create your first server or join one with an invite code.</p><button id="empty-create" class="button button-secondary">Create a server</button></div>';$("my-server-grid").innerHTML=html||'<div class="empty-card"><h3>No servers yet</h3><p>Join or create a server to see it here.</p></div>';$("room-count").textContent=state.servers.length+" rooms";$("sidebar-servers").innerHTML=state.servers.map(s=>'<button class="side-server" data-server="'+s.id+'">▦ &nbsp;'+esc(s.name)+'</button>').join("")||'<div class="side-empty">Your servers will show up here</div>';document.querySelectorAll("[data-server]").forEach(x=>x.addEventListener("click",()=>openRoom(x.dataset.server)));$("empty-create")?.addEventListener("click",()=>auth()&&$("server-dialog").showModal())}
async function loadServers(){if(!state.user){state.servers=[];renderServers();return}const r=await db.from("servers").select("id,name,description,owner_id,join_code,created_at").order("created_at",{ascending:false});if(r.error){console.error(r.error);toast("Server load failed: "+r.error.message);return}state.servers=r.data||[];renderServers()}
async function openRoom(id){const s=state.servers.find(x=>x.id===id);if(!s)return;state.room=s;$("room-title").textContent=s.name;$("room-description").textContent=s.description||"";$("room-kicker").textContent="SERVER / "+s.name.toUpperCase();$("leave-server").classList.toggle("hidden",s.owner_id===state.user?.id);view("room");await loadBotSettings();await loadMessages();subscribe();const m=await db.from("server_members").select("*",{count:"exact",head:true}).eq("server_id",id);$("member-count").textContent=m.count??"—"}
async function loadMessages(){const r=await db.from("messages").select("id,server_id,user_id,content,sender_type,bot_id,created_at").eq("server_id",state.room.id).order("created_at",{ascending:true}).limit(100);if(r.error){toast("Could not load messages");return}state.messages=r.data||[];renderMessages()}
function renderMessages(){const list=$("message-list");if(!state.messages.length){list.innerHTML='<div class="message-empty">The floor is empty. Make the opening argument.</div>';return}list.innerHTML=state.messages.map(m=>{const bot=m.sender_type==="bot";const n=bot?(BOT_META[m.bot_id]?.name||"Council bot"):(m.user_id===state.user?.id?name():"Council member");return '<div class="message '+(bot?"bot-message":"")+'"><div class="message-avatar">'+esc(n[0])+(bot?"✦":"")+'</div><div class="message-body"><div class="message-meta"><span class="message-author">'+esc(n)+(bot?' <span class="bot-label">AI</span>':"")+'</span><span class="message-time">'+new Date(m.created_at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})+'</span></div><div class="message-text">'+esc(m.content)+'</div></div></div>'}).join("");list.scrollTop=list.scrollHeight}
function subscribe(){if(state.channel)db.removeChannel(state.channel);state.channel=db.channel("room-"+state.room.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"server_id=eq."+state.room.id},p=>{if(!state.messages.some(m=>m.id===p.new.id)){state.messages.push(p.new);renderMessages()}}).subscribe()}

function renderBotSettings(){
  const owner=state.room?.owner_id===state.user?.id;
  $("bot-list").innerHTML=Object.entries(BOT_META).map(([id,b])=>{
    const active=state.enabledBotIds.includes(id);
    return '<label class="bot-row"><span class="bot-avatar">'+b.avatar+'</span><span class="bot-copy"><b>'+b.name+'</b><small>'+b.tagline+'</small></span>'+(owner?'<input class="bot-choice" type="checkbox" data-bot="'+id+'" '+(active?'checked':'')+'>':'<span class="bot-state">'+(state.botsEnabled&&active?'ON':'OFF')+'</span>')+'</label>'
  }).join("");
  $("bot-toggle").disabled=!owner;
  $("bot-toggle").textContent=state.botsEnabled?"Disable council bots":"Enable council bots";
  $("bot-toggle").classList.toggle("button-primary",state.botsEnabled);
  $("bot-toggle").classList.toggle("button-secondary",!state.botsEnabled);
  $("bot-model-status").textContent=state.botsEnabled?"Bots are enabled. Replies run locally on the device that sends a message.":"Bots are off in this server.";
}
async function loadBotSettings(){
  state.botsEnabled=false;state.enabledBotIds=["greg","susan","nugget"];
  const r=await db.from("server_bots").select("enabled,enabled_bot_ids").eq("server_id",state.room.id).maybeSingle();
  if(r.error){console.error("Bot settings load failed",r.error);toast("Could not load bot settings: "+r.error.message)}
  else if(r.data){state.botsEnabled=!!r.data.enabled;state.enabledBotIds=r.data.enabled_bot_ids||[]}
  renderBotSettings();
}
async function saveBotSettings(){
  if(state.room?.owner_id!==state.user?.id)return;
  const r=await db.rpc("configure_server_bots",{p_server_id:state.room.id,p_enabled:state.botsEnabled,p_bot_ids:state.enabledBotIds});
  if(r.error){toast("Could not save bot settings: "+r.error.message);return}
  renderBotSettings();
}
async function chooseDeviceModel(){
  const mode=$("model-mode").value||"auto";
  const mobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  const memory=Number(navigator.deviceMemory||0);
  let gpu=false;
  if(navigator.gpu&&!mobile){try{gpu=!!(await navigator.gpu.requestAdapter())}catch{}}
  // Mobile browsers can be terminated by iOS during large GPU allocations.
  // Keep phones on the 135M quantized CPU profile for a safer first load.
  const model="onnx-community/SmolLM2-135M-Instruct-ONNX";
  const label="SmolLM2 135M";
  if(mode==="balanced"&&!mobile){
    return {model:"onnx-community/Qwen2.5-0.5B-Instruct",label:"Qwen 0.5B",device:gpu?"webgpu":"wasm",dtype:gpu?"q4f16":"q4",mobile,memory,gpu};
  }
  return {model,label,device:gpu?"webgpu":"wasm",dtype:gpu?"q4f16":"q4",mobile,memory,gpu};
}
function setModelStatus(message,percent){
  $("bot-model-status").textContent=message;
  const wrap=$("bot-model-progress-wrap"),bar=$("bot-model-progress");
  wrap.classList.toggle("hidden",percent===null||percent===undefined);
  if(percent!==null&&percent!==undefined)bar.style.width=Math.max(0,Math.min(100,percent))+"%";
}
async function requestPersistentModelStorage(){
  const storage=navigator.storage;
  if(!storage)return false;
  try{
    if(typeof storage.persisted==="function"&&await storage.persisted())return true;
    if(typeof storage.persist==="function")return !!(await storage.persist());
  }catch(error){
    console.warn("Persistent browser storage request failed",error);
  }
  return false;
}
async function loadLocalBotModel(){
  if(state.modelPipeline)return state.modelPipeline;
  if(state.modelPromise)return state.modelPromise;
  state.modelPromise=(async()=>{
    const profile=await chooseDeviceModel();state.modelProfile=profile;
    setModelStatus("Preparing "+profile.label+" · requesting persistent browser storage",0);
    state.modelStoragePersistent=await requestPersistentModelStorage();
    const lib=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2");
    lib.env.allowLocalModels=false;
    // Transformers.js stores downloaded model files in the browser Cache API.
    // Request persistent origin storage first so the browser is less likely to evict them.
    lib.env.useBrowserCache=true;
    let lastProgress=0;
    const onProgress=info=>{
      if(info?.status==="progress"&&typeof info.progress==="number"){
        const p=info.progress<=1?info.progress*100:info.progress;
        lastProgress=Math.max(lastProgress,p);
        setModelStatus("Downloading "+(info.file||profile.label)+" · "+Math.round(p)+"%",p);
      }else if(info?.status==="done"){
        setModelStatus("Download complete. Loading model into memory… keep this tab open.",100);
      }
    };
    try{
      state.modelPipeline=await lib.pipeline("text-generation",profile.model,{
        device:profile.device,dtype:profile.dtype,progress_callback:onProgress
      });
    }catch(firstError){
      if(profile.device!=="webgpu")throw firstError;
      setModelStatus("WebGPU initialization failed. Retrying the small model on CPU…",null);
      const fallbackModel="onnx-community/SmolLM2-135M-Instruct-ONNX";
      state.modelProfile={...profile,model:fallbackModel,label:"SmolLM2 135M",device:"wasm",dtype:"q4"};
      state.modelPipeline=await lib.pipeline("text-generation",fallbackModel,{
        device:"wasm",dtype:"q4",progress_callback:onProgress
      });
    }
    setModelStatus(profile.label+" loaded and cached in this browser. "+(state.modelStoragePersistent?"Persistent storage was granted, so refreshes should reuse the download.":"The browser cache is enabled, but this browser did not grant persistent storage and may evict cached files."),null);
    return state.modelPipeline;
  })().catch(error=>{
    state.modelPromise=null;state.modelPipeline=null;
    setModelStatus("Model couldn't start: "+(error?.message||String(error))+". Try reloading the page.",null);
    throw error;
  });
  return state.modelPromise;
}
function buildBotPrompt(botId,newMessage){
  const bot=BOT_META[botId];
  const history=state.messages.slice(-8).filter(m=>m.sender_type!=="bot"||m.bot_id!==botId).map(m=>{
    const who=m.sender_type==="bot"?(BOT_META[m.bot_id]?.name||"Council bot"):(m.user_id===state.user?.id?name():"Member");
    return who+": "+m.content;
  }).join("\n");
  return "You are "+bot.name+", an AI debate participant in Nugget Council. Personality: "+bot.style+"\nRules: Be concise (2 to 5 sentences). Address the actual argument, add a useful counterpoint or insight, and do not pretend to have checked sources. Keep it respectful and age-appropriate. Do not produce sexual content, graphic violence, or instructions for dangerous activity.\nRecent discussion:\n"+history+"\nLatest member message:\n"+newMessage+"\n"+bot.name+":";
}
async function maybeGenerateBotReply(message,roomId,sourceMessageId){
  if(state.botGenerating||!state.botsEnabled||!state.enabledBotIds.length||state.room?.id!==roomId)return;
  state.botGenerating=true;
  const botId=state.enabledBotIds[Math.floor(Math.random()*state.enabledBotIds.length)];
  try{
    const model=await loadLocalBotModel();
    if(state.room?.id!==roomId)return;
    setModelStatus("Thinking locally…",null);
    const output=await model(buildBotPrompt(botId,message),{max_new_tokens:72,temperature:.72,do_sample:true,return_full_text:false});
    let reply=output?.[0]?.generated_text;
    if(Array.isArray(reply))reply=reply.map(x=>x?.content||"").join(" ");
    reply=String(reply||"").replace(/^\s*"+|"+\s*$/g,"").trim();
    if(!reply){setModelStatus("The model returned an empty reply. Try again with another message.",null);return}
    const cleaned=reply.replace(/^(greg|susan|nugget jr?\.?|member|yuan bernardino)\s*:\s*/i,"").trim();
    const tokens=cleaned.split(/\s+/).filter(Boolean);
    const weirdTokens=(cleaned.match(/\b\d{3,}\b/g)||[]).length;
    const repeatedPhrases=/(.{12,})\s+\1/i.test(cleaned);
    const unrelatedTranscript=/\b(previous member to a participant|please review the responses so far|i have found a large group)\b/i.test(cleaned);
    const hasConversationShape=tokens.length>=4&&/[.!?]/.test(cleaned);
    if(tokens.length<4||weirdTokens>=2||repeatedPhrases||unrelatedTranscript||!hasConversationShape){
      setModelStatus(BOT_META[botId].name+" skipped an unclear draft instead of posting nonsense.",null);
      return;
    }
    reply=cleaned;
    if(reply.length>1900)reply=reply.slice(0,1900).replace(/\s+\S*$/,"")+"…";
    const posted=await db.rpc("post_bot_message",{p_server_id:roomId,p_bot_id:botId,p_content:reply,p_source_message_id:sourceMessageId});
    if(posted.error){
      if(!/short pause/i.test(posted.error.message||""))console.warn("Bot reply rejected",posted.error);
      setModelStatus(/short pause/i.test(posted.error.message||"")?"Council cooldown active.":"Could not post the council reply: "+posted.error.message,null);
    }else setModelStatus(BOT_META[botId].name+" replied · running locally",null);
  }catch(error){
    console.error("Local council model failed",error);
    toast("AI reply failed: "+(error?.message||"Model error"));
  }finally{state.botGenerating=false}
}
async function createServer(n,d){
  const refreshed=await db.auth.refreshSession();
  if(refreshed.error){
    toast("Session refresh failed: "+refreshed.error.message);
    return
  }
  const verified=await db.auth.getUser();
  const currentUser=verified.data.user;
  if(verified.error||!currentUser||!refreshed.data.session){
    state.user=null;
    updateUser();
    toast("Could not verify your session. Please sign in again.");
    auth();
    return
  }
  state.user=currentUser;
  updateUser();
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes=crypto.getRandomValues(new Uint8Array(5));
  const code=Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
  const r=await db.rpc("create_server",{
    p_name:n,
    p_description:d,
    p_join_code:code
  });
  if(r.error){
    console.error("Create server RPC failed",r.error);
    const detail=[r.error.message,r.error.details,r.error.hint,r.error.code].filter(Boolean).join(" | ");
    toast("Could not create server: "+detail);
    return
  }
  const server=Array.isArray(r.data)?r.data[0]:r.data;
  if(!server){
    toast("Server creation returned no server record. Please refresh and check your rooms.");
    return
  }
  state.servers.unshift(server);
  renderServers();
  $("server-dialog").close();
  toast("Created! Invite code: "+code);
  openRoom(server.id)
}
async function joinServer(code){if(!auth())return;const r=await db.rpc("join_server",{p_join_code:code.toUpperCase()});if(r.error){toast(r.error.message);return}await loadServers();$("join-dialog").close();toast("You joined the server");openRoom(r.data)}
async function sendMessage(s){const roomId=state.room.id;const r=await db.from("messages").insert({server_id:roomId,user_id:state.user.id,content:s,sender_type:"user",bot_id:null}).select("id").single();if(r.error){toast(r.error.message);return}$("message-input").value="";if(state.botsEnabled)maybeGenerateBotReply(s,roomId,r.data.id)}
async function signOut(){if(state.channel)db.removeChannel(state.channel);await db.auth.signOut();state.room=null;view("discover")}
function updateUser(){$("user-label").textContent=state.user?name():"Guest";$("auth-open").textContent=state.user?"Sign out":"Sign in"}
async function init(){if(!db){$("connection-label").textContent="Not configured";toast("Supabase config missing");return}const s=await db.auth.getSession();state.user=s.data.session?.user||null;updateUser();$("connection-label").textContent="Connected";await loadServers();db.auth.onAuthStateChange((_e,s)=>{state.user=s?.user||null;updateUser();setTimeout(loadServers,0);if(!state.user){state.room=null;view("discover")}})}
$("auth-open").addEventListener("click",()=>state.user?signOut():auth());
$("auth-switch").addEventListener("click",()=>setAuthMode(state.authMode==="signin"?"signup":"signin"));
$("auth-form").addEventListener("submit",async e=>{e.preventDefault();const email=$("auth-email").value.trim(),password=$("auth-password").value;const up=state.authMode==="signup";const r=up?await db.auth.signUp({email,password,options:{data:{display_name:$("display-name").value.trim()||email.split("@")[0]}}}):await db.auth.signInWithPassword({email,password});if(r.error){toast(r.error.message);return}if(up&&!r.data.session){$("auth-dialog").close();toast("Check your email to confirm your account");return}state.user=r.data.user;$("auth-dialog").close();updateUser();await loadServers();toast(up?"Account created":"Welcome back")});
$("hero-create").addEventListener("click",()=>auth()&&$("server-dialog").showModal());$("sidebar-create").addEventListener("click",()=>auth()&&$("server-dialog").showModal());$("hero-join").addEventListener("click",()=>auth()&&$("join-dialog").showModal());
$("server-form").addEventListener("submit",e=>{e.preventDefault();createServer($("server-name").value.trim(),$("server-description").value.trim())});
$("join-form").addEventListener("submit",e=>{e.preventDefault();joinServer($("join-code").value.trim())});
$("message-form").addEventListener("submit",e=>{e.preventDefault();const s=$("message-input").value.trim();if(s)sendMessage(s)});
$("invite-button").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(state.room.join_code);toast("Invite code copied")}catch{toast("Invite code: "+state.room.join_code)}});
$("back-to-rooms").addEventListener("click",async()=>{
  if(state.channel){
    await db.removeChannel(state.channel);
    state.channel=null
  }
  state.room=null;
  view("discover");
  await loadServers()
});
$("room-settings").addEventListener("click",()=>{if(state.room.owner_id!==state.user?.id){toast("Only the owner can edit this server");return}$("settings-name").value=state.room.name;$("settings-description").value=state.room.description||"";$("settings-code").textContent=state.room.join_code;$("settings-dialog").showModal()});
$("settings-form").addEventListener("submit",async e=>{e.preventDefault();const r=await db.from("servers").update({name:$("settings-name").value.trim(),description:$("settings-description").value.trim()}).eq("id",state.room.id).select().single();if(r.error){toast(r.error.message);return}state.room=r.data;await loadServers();$("room-title").textContent=r.data.name;$("room-description").textContent=r.data.description||"";$("settings-dialog").close();toast("Server updated")});
$("delete-server").addEventListener("click",async()=>{
  const room=state.room;
  if(!room||room.owner_id!==state.user?.id){
    toast("Only the server owner can delete this server");
    return
  }
  if(!confirm('Permanently delete "'+room.name+'"? This also deletes all messages and removes every member. This cannot be undone.'))return;
  const serverId=room.id;
  const r=await db.from("servers").delete().eq("id",serverId).select("id").maybeSingle();
  if(r.error){
    console.error("Delete server failed",r.error);
    toast("Could not delete server: "+r.error.message);
    return
  }
  if(!r.data){
    toast("Server was not deleted. Check that you are still the owner.");
    return
  }
  if(state.channel){
    await db.removeChannel(state.channel);
    state.channel=null
  }
  state.room=null;
  $("settings-dialog").close();
  await loadServers();
  view("discover");
  toast("Server deleted")
});
$("leave-server").addEventListener("click",async()=>{if(!confirm("Leave this server?"))return;const r=await db.from("server_members").delete().eq("server_id",state.room.id).eq("user_id",state.user.id);if(r.error){toast(r.error.message);return}if(state.channel)db.removeChannel(state.channel);state.room=null;await loadServers();view("discover")});
$("bot-toggle").addEventListener("click",async()=>{if(state.room?.owner_id!==state.user?.id)return;if(!state.enabledBotIds.length)state.enabledBotIds=["greg","susan","nugget"];state.botsEnabled=!state.botsEnabled;await saveBotSettings();toast(state.botsEnabled?"Council bots enabled":"Council bots disabled")});
$("bot-list").addEventListener("change",async e=>{if(!e.target.matches(".bot-choice"))return;const id=e.target.dataset.bot;state.enabledBotIds=e.target.checked?[...new Set([...state.enabledBotIds,id])]:state.enabledBotIds.filter(x=>x!==id);await saveBotSettings()});
$("model-mode").value=localStorage.getItem("nugget-model-mode")||"auto";$("model-mode").addEventListener("change",()=>{localStorage.setItem("nugget-model-mode",$("model-mode").value);state.modelPipeline=null;state.modelPromise=null;state.modelProfile=null;setModelStatus("Model choice updated. It will be selected when the next reply is needed.",null)});
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>view(b.dataset.view)));
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".mode-panel").forEach(x=>x.classList.remove("active"));$(b.dataset.mode+"-mode").classList.add("active")}));
$("theme-toggle").addEventListener("click",()=>document.body.classList.toggle("light"));
init();