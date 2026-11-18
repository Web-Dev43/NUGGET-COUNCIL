import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.SUPABASE_CONFIG;
const db=cfg?.url&&cfg?.publishableKey?createClient(cfg.url,cfg.publishableKey):null;
const $=id=>document.getElementById(id);
const state={user:null,servers:[],room:null,channel:null,messages:[],authMode:"signin",bots:false};
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
async function openRoom(id){const s=state.servers.find(x=>x.id===id);if(!s)return;state.room=s;$("room-title").textContent=s.name;$("room-description").textContent=s.description||"";$("room-kicker").textContent="SERVER / "+s.name.toUpperCase();$("bot-toggle").disabled=s.owner_id!==state.user?.id;$("bot-toggle").textContent=s.owner_id===state.user?.id?"Enable council bots":"Owner controls bots";$("bot-list").innerHTML=["Greg · argumentative","Susan · logical","Nugget Jr · chaotic"].map((x,i)=>'<div class="bot-row"><span class="bot-avatar">'+["G","S","N"][i]+'</span>'+x+'<span class="bot-state">OFF</span></div>').join("");view("room");await loadMessages();subscribe();const m=await db.from("server_members").select("*",{count:"exact",head:true}).eq("server_id",id);$("member-count").textContent=m.count??"—"}
async function loadMessages(){const r=await db.from("messages").select("id,server_id,user_id,content,created_at").eq("server_id",state.room.id).order("created_at",{ascending:true}).limit(100);if(r.error){toast("Could not load messages");return}state.messages=r.data||[];renderMessages()}
function renderMessages(){const list=$("message-list");if(!state.messages.length){list.innerHTML='<div class="message-empty">The floor is empty. Make the opening argument.</div>';return}list.innerHTML=state.messages.map(m=>{const n=m.user_id===state.user?.id?name():"Council member";return '<div class="message"><div class="message-avatar">'+esc(n[0])+'</div><div class="message-body"><div class="message-meta"><span class="message-author">'+esc(n)+'</span><span class="message-time">'+new Date(m.created_at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})+'</span></div><div class="message-text">'+esc(m.content)+'</div></div></div>'}).join("");list.scrollTop=list.scrollHeight}
function subscribe(){if(state.channel)db.removeChannel(state.channel);state.channel=db.channel("room-"+state.room.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"server_id=eq."+state.room.id},p=>{if(!state.messages.some(m=>m.id===p.new.id)){state.messages.push(p.new);renderMessages()}}).subscribe()}
async function createServer(n,d){
  const refreshed=await db.auth.refreshSession();
  if(refreshed.error){
    console.error("Session refresh failed",refreshed.error);
    toast("Session refresh failed: "+refreshed.error.message);
    return
  }
  const verified=await db.auth.getUser();
  const currentUser=verified.data.user;
  const session=refreshed.data.session;
  if(verified.error||!currentUser||!session){
    state.user=null;
    updateUser();
    toast("Could not verify your session. Please sign in again.");
    auth();
    return
  }
  const jwtSub=(()=>{try{return JSON.parse(atob(session.access_token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).sub}catch{return null}})();
  if(jwtSub!==currentUser.id){
    console.error("Auth identity mismatch",{jwtSub,verifiedUserId:currentUser.id});
    toast("Session identity mismatch. Sign out and sign in again.");
    return
  }
  state.user=currentUser;
  updateUser();
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes=crypto.getRandomValues(new Uint8Array(5));
  const code=Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
  const r=await db.from("servers").insert({
    name:n,description:d,owner_id:currentUser.id,join_code:code
  }).select().single();
  if(r.error){
    console.error("Create server failed",r.error,{verifiedUserId:currentUser.id,jwtSub});
    const detail=[r.error.message,r.error.details,r.error.hint,r.error.code].filter(Boolean).join(" | ");
    toast("Could not create server: "+detail);
    return
  }
  state.servers.unshift(r.data);
  renderServers();
  $("server-dialog").close();
  toast("Created! Invite code: "+code);
  openRoom(r.data.id)
}
async function joinServer(code){if(!auth())return;const r=await db.rpc("join_server",{p_join_code:code.toUpperCase()});if(r.error){toast(r.error.message);return}await loadServers();$("join-dialog").close();toast("You joined the server");openRoom(r.data)}
async function sendMessage(s){const r=await db.from("messages").insert({server_id:state.room.id,user_id:state.user.id,content:s});if(r.error){toast(r.error.message);return}$("message-input").value=""}
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
$("room-settings").addEventListener("click",()=>{if(state.room.owner_id!==state.user?.id){toast("Only the owner can edit this server");return}$("settings-name").value=state.room.name;$("settings-description").value=state.room.description||"";$("settings-code").textContent=state.room.join_code;$("settings-dialog").showModal()});
$("settings-form").addEventListener("submit",async e=>{e.preventDefault();const r=await db.from("servers").update({name:$("settings-name").value.trim(),description:$("settings-description").value.trim()}).eq("id",state.room.id).select().single();if(r.error){toast(r.error.message);return}state.room=r.data;await loadServers();$("room-title").textContent=r.data.name;$("room-description").textContent=r.data.description||"";$("settings-dialog").close();toast("Server updated")});
$("leave-server").addEventListener("click",async()=>{if(!confirm("Leave this server?"))return;const r=await db.from("server_members").delete().eq("server_id",state.room.id).eq("user_id",state.user.id);if(r.error){toast(r.error.message);return}if(state.channel)db.removeChannel(state.channel);state.room=null;await loadServers();view("discover")});
$("bot-toggle").addEventListener("click",()=>{if(state.room?.owner_id!==state.user?.id)return;state.bots=!state.bots;document.querySelectorAll(".bot-state").forEach(x=>x.textContent=state.bots?"READY":"OFF");$("bot-toggle").textContent=state.bots?"Disable council bots":"Enable council bots";toast("Bot controls changed. Replies are not live yet.")});
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>view(b.dataset.view)));
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".mode-panel").forEach(x=>x.classList.remove("active"));$(b.dataset.mode+"-mode").classList.add("active")}));
$("theme-toggle").addEventListener("click",()=>document.body.classList.toggle("light"));
init();