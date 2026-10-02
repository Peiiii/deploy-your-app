import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,name,scope){
 const source=fs.readFileSync(file,'utf8').replace(/^import[\s\S]*?;\s*$/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const sandbox={exports:{},console:{error(){}},AbortSignal,URLSearchParams,...scope};vm.runInNewContext(js,sandbox);return sandbox.exports[name];
}
function store(initial){let state=initial;return {getState:()=>state,setState:update=>{state={...state,...(typeof update==='function'?update(state):update)};}};}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const user={id:'A',email:'qa@example.invalid'};
const auth=store({user:null,isLoading:true,sessionError:null,email:user.email,password:'test-existing-password',mode:'login'});
let requests=[];
const Auth=load('frontend/src/features/auth/managers/auth.manager.ts','AuthManager',{useAuthStore:auth,APP_CONFIG:{API_BASE_URL:'/api/v1'},i18n:{t:k=>k},track(){},fetch:(url)=>{const task=deferred();requests.push({url,...task});return task.promise;}});
const manager=new Auth();
const first=manager.loadCurrentUser();assert.equal(manager.loadCurrentUser(),first);assert.equal(requests.length,1);
requests[0].reject(new Error('offline'));await first;assert.equal(auth.getState().sessionError,'failed_to_load_user');assert.equal(auth.getState().isLoading,false);
const second=manager.loadCurrentUser();requests[1].resolve(Response.json({}, {status:401}));await second;assert.equal(auth.getState().sessionError,null);assert.equal(auth.getState().user,null);
const pending=manager.loadCurrentUser();const login=manager.submitEmailLogin();requests[3].resolve(Response.json({user}));await login;requests[2].resolve(Response.json({user:null}));await pending;assert.equal(auth.getState().user.id,'A','old restoration cannot overwrite successful login');
const restore=manager.loadCurrentUser();const logout=manager.logout();requests[5].resolve(Response.json({}));await logout;requests[4].resolve(Response.json({user}));await restore;assert.equal(auth.getState().user,null,'old restoration cannot resurrect signed-out session');
console.log('PASS session: dedup, offline vs 401, retry, login/logout races');
const projects=store({projects:[],isLoading:false,hasLoaded:false,pagination:{page:0,pageSize:2,total:0,hasMore:false}});
const actions={reset:()=>projects.setState({projects:[],isLoading:false,hasLoaded:false}),setIsLoading:isLoading=>projects.setState({isLoading,...(isLoading?{loadError:null}:{})}),setLoadError:loadError=>projects.setState({loadError}),setProjects:(response,append)=>projects.setState(s=>({projects:append?[...s.projects,...response.items]:response.items,hasLoaded:true,pagination:{...response,hasMore:response.page*response.pageSize<response.total}}))};projects.setState({actions});
requests=[];auth.setState({user});
const Project=load('frontend/src/managers/project.manager.ts','ProjectManager',{useProjectStore:projects,useAuthStore:auth,track(){}});
const pm=new Project({getProjects:page=>{const task=deferred();requests.push({page,...task});return task.promise;}});
const a=pm.loadProjects();await pm.loadProjects();assert.equal(requests.length,1);
auth.setState({user:{...user,id:'B'}});const b=pm.loadProjects();assert.equal(requests.length,2,'new account not blocked by old in-flight request');requests[1].resolve({items:[{id:'B-project'}],page:1,pageSize:2,total:3});await b;requests[0].resolve({items:[{id:'A-project'}],page:1,pageSize:2,total:1});await a;assert.equal(projects.getState().projects[0].id,'B-project');assert.equal(projects.getState().isLoading,false);
const more=pm.loadMore();requests[2].reject(new Error('offline'));await more;assert.equal(projects.getState().projects.length,1);assert.equal(projects.getState().loadError,'failed_to_load_projects');const retry=pm.loadMore();assert.equal(requests[3].page,2);requests[3].resolve({items:[{id:'B-last'}],page:2,pageSize:2,total:3});await retry;assert.equal(projects.getState().pagination.hasMore,false);assert.equal(projects.getState().projects.length,2);await pm.loadMore();assert.equal(requests.length,4);
console.log('PASS projects: dedup, account switch, retained content, retry same page, final-page termination');
const explore=store({apps:[],page:1,activeCategory:'All Apps',activeTag:null,searchQuery:'',hasMore:false,isLoading:false,error:null});
const ea={setIsLoading:isLoading=>explore.setState({isLoading}),setError:error=>explore.setState({error}),setApps:apps=>explore.setState({apps}),appendApps:apps=>explore.setState(s=>({apps:[...s.apps,...apps]})),setPage:page=>explore.setState({page}),setHasMore:hasMore=>explore.setState({hasMore})};explore.setState({actions:ea});requests=[];
const Explore=load('frontend/src/features/explore/managers/explore.manager.ts','ExploreManager',{useExploreStore:explore,useAppLanguageStore:{getState:()=>({languages:null,actions:{setAvailable(){}}})},useAuthStore:auth,track(){},mapProjectsToApps:x=>x,fetchExploreProjects:params=>{const task=deferred();requests.push({params,...task});return task.promise;}});
const em=new Explore({},{},{loadReactionsForProjectsBulk(){},seedCountsFromProjects(){}});
const old=em.loadPage(1);explore.setState({searchQuery:'new'});const newer=em.loadPage(1);requests[1].resolve({items:[{id:'new'}],page:1,total:13});await newer;requests[0].resolve({items:[{id:'old'}],page:1,total:99});await old;assert.equal(explore.getState().apps[0].id,'new');const next=em.loadPage(2,true);requests[2].reject(new Error('offline'));await next;assert.equal(explore.getState().error,'append_failed');assert.equal(explore.getState().apps[0].id,'new');em.retry();assert.equal(requests[3].params.page,2);requests[3].resolve({items:[{id:'last'}],page:2,total:13});await new Promise(r=>setImmediate(r));assert.equal(explore.getState().hasMore,false);assert.equal(explore.getState().apps.length,2);em.loadMore();assert.equal(requests.length,4);
console.log('PASS explore: stale search discarded, append error preserves results, retry/final page');
const profile=store({data:null,isLoading:false,error:null,requestedId:null});
profile.setState({actions:{setRequestedId:requestedId=>profile.setState({requestedId,data:null}),setIsLoading:isLoading=>profile.setState({isLoading}),setError:error=>profile.setState({error}),setData:data=>profile.setState({data})}});
requests=[];
const Public=load('frontend/src/features/profile/managers/public-profile.manager.ts','PublicProfileManager',{Error,usePublicProfileStore:profile,fetchPublicProfile:id=>{const task=deferred();requests.push({id,...task});return task.promise;}});
const publicManager=new Public({getCurrentUser:()=>null},{seedCountsFromProjects(){}});
const older=publicManager.loadProfile('old');const latest=publicManager.loadProfile('new');requests[1].resolve({user:{id:'new'},projects:[]});await latest;requests[0].resolve({user:{id:'old'},projects:[]});await older;assert.equal(profile.getState().data.user.id,'new');
const missing=publicManager.loadProfile('missing');requests[2].reject(new Error('not_found'));await missing;assert.equal(profile.getState().error,'not_found');const offline=publicManager.loadProfile('retry');requests[3].reject(new Error('offline'));await offline;assert.equal(profile.getState().error,'network');assert.equal(profile.getState().isLoading,false);
console.log('PASS public profile: stale identity discarded, 404 distinct from retryable network failure');
let patches=0;const draft=store({isLoading:false,isSaving:false,loadError:'offline',profileData:null});draft.setState({actions:{setIsLoading:isLoading=>draft.setState({isLoading}),setLoadError:loadError=>draft.setState({loadError})}});
const My=load('frontend/src/features/profile/managers/my-profile.manager.ts','MyProfileManager',{useMyProfileStore:draft,track(){},i18n:{t:k=>k},updateMyProfile:()=>{patches++;},fetchPublicProfile:async()=>{throw new Error('offline');}});
const myManager=new My({getCurrentUser:()=>user},{});await myManager.saveProfile();await myManager.loadProfile();await myManager.saveProfile();assert.equal(patches,0,'failed initial profile cannot save a blank draft');assert.equal(draft.getState().isLoading,false);assert.equal(draft.getState().loadError,'failed_to_load_profile');
console.log('PASS own profile: network failure has terminal retry state and cannot overwrite data');
