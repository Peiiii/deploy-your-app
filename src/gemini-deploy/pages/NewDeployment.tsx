import React, { useRef, useEffect } from 'react';
import { useDeploymentStore } from '../stores/deploymentStore';
import { usePresenter } from '../contexts/PresenterContext';
import { DeploymentStatus } from '../types';
import { Terminal } from '../components/Terminal';
import { ArrowRight, ShieldCheck, Cpu, Github, Globe, Loader2, Sparkles, FolderArchive, Upload, FileCode, X, Check, ExternalLink } from 'lucide-react';
import { URLS } from '../constants';

const STEPS = [
    { id: 1, label: 'Source', desc: 'Connect code' },
    { id: 2, label: 'Secure', desc: 'AI Proxy' },
    { id: 3, label: 'Deploy', desc: 'Go Live' }
];

export const NewDeployment: React.FC = () => {
  const presenter = usePresenter();
  const state = useDeploymentStore(); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => presenter.deployment.resetWizard();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      presenter.deployment.handleFileDrop(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      presenter.deployment.handleFileDrop(e.dataTransfer.files[0]);
    }
  };

  const handleDeployStart = () => {
    presenter.deployment.startBuildSimulation(() => {
       const identifier = state.sourceType === 'github' ? state.repoUrl : (state.zipFile?.name || 'archive.zip');
       const url = URLS.getDeploymentUrl(state.projectName);
       presenter.project.addProject(state.projectName, url, state.sourceType, identifier);
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-8 animate-fade-in">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Deploy New Project</h1>
        <p className="text-slate-500 dark:text-gray-400">Ship your Gemini AI application securely to the edge.</p>
      </div>

      {/* Modern Stepper */}
      <div className="flex items-center justify-center mb-12 relative max-w-2xl mx-auto">
        {/* Connecting Line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-gray-800 -z-10 rounded-full"></div>
        <div className="absolute top-1/2 left-0 h-0.5 bg-brand-500 -z-10 rounded-full transition-all duration-500 ease-out" 
             style={{ width: `${((state.step - 1) / (STEPS.length - 1)) * 100}%` }}></div>

        {STEPS.map((s, i) => {
            const isActive = i + 1 === state.step;
            const isCompleted = i + 1 < state.step;
            return (
                <div key={i} className="flex-1 flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 z-10 bg-white dark:bg-app-bg ${
                        isActive ? 'border-brand-500 text-brand-600 dark:text-brand-400 shadow-[0_0_15px_rgba(56,189,248,0.4)] scale-110' : 
                        isCompleted ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 dark:border-gray-700 text-slate-400 dark:text-gray-500'
                    }`}>
                        {isCompleted ? <Check className="w-5 h-5" /> : i + 1}
                    </div>
                    <div className={`mt-3 text-center transition-colors ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}>
                        <span className="text-xs font-bold uppercase tracking-wider block">{s.label}</span>
                        <span className="text-[10px] hidden sm:block">{s.desc}</span>
                    </div>
                </div>
            )
        })}
      </div>

      {/* Step 1: Connect Source */}
      {state.step === 1 && (
        <div className="glass-card rounded-2xl p-8 animate-slide-up">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Github className="w-6 h-6 text-brand-500 dark:text-brand-400" /> Select Import Source
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button 
                onClick={() => state.actions.setSourceType('github')}
                className={`relative group p-6 rounded-xl border-2 text-left transition-all duration-200 ${
                    state.sourceType === 'github' 
                    ? 'bg-brand-500/10 border-brand-500 shadow-[0_0_20px_rgba(56,189,248,0.15)]' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-brand-500/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${state.sourceType === 'github' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-400 group-hover:bg-slate-200 dark:group-hover:bg-gray-700'}`}>
                        <Github className="w-6 h-6" />
                    </div>
                    {state.sourceType === 'github' && <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center"><Check className="w-3 h-3" /></div>}
                </div>
                <h3 className={`text-lg font-bold mb-1 ${state.sourceType === 'github' ? 'text-brand-900 dark:text-white' : 'text-slate-700 dark:text-gray-300'}`}>GitHub Repository</h3>
                <p className="text-sm text-slate-500 dark:text-gray-500">Import directly from your Git repositories.</p>
            </button>

            <button 
                onClick={() => state.actions.setSourceType('zip')}
                className={`relative group p-6 rounded-xl border-2 text-left transition-all duration-200 ${
                    state.sourceType === 'zip' 
                    ? 'bg-brand-500/10 border-brand-500 shadow-[0_0_20px_rgba(56,189,248,0.15)]' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-brand-500/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${state.sourceType === 'zip' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-400 group-hover:bg-slate-200 dark:group-hover:bg-gray-700'}`}>
                        <FolderArchive className="w-6 h-6" />
                    </div>
                    {state.sourceType === 'zip' && <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center"><Check className="w-3 h-3" /></div>}
                </div>
                <h3 className={`text-lg font-bold mb-1 ${state.sourceType === 'zip' ? 'text-brand-900 dark:text-white' : 'text-slate-700 dark:text-gray-300'}`}>Upload Zip</h3>
                <p className="text-sm text-slate-500 dark:text-gray-500">Drag and drop your AI Studio export.</p>
            </button>
          </div>

          <div className="min-h-[160px] bg-slate-50 dark:bg-black/20 rounded-xl p-6 border border-slate-200 dark:border-white/5">
            {state.sourceType === 'github' ? (
                <div className="animate-fade-in max-w-xl mx-auto">
                    <label className="block text-sm font-medium text-slate-500 dark:text-gray-400 mb-2">Repository URL</label>
                    <div className="relative group">
                        <Github className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 dark:text-gray-500 group-focus-within:text-brand-500 transition-colors" />
                        <input 
                            type="text" 
                            value={state.repoUrl}
                            onChange={(e) => {
                              state.actions.setRepoUrl(e.target.value);
                              presenter.deployment.autoProjectName(e.target.value, 'github');
                            }}
                            placeholder="github.com/username/project"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-12 pr-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-slate-400 dark:placeholder:text-gray-700"
                        />
                    </div>
                </div>
            ) : (
                <div 
                    className="animate-fade-in border-2 border-dashed border-slate-300 dark:border-gray-700 hover:border-brand-500/50 rounded-xl h-40 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white/50 dark:bg-app-bg/50 group"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input type="file" ref={fileInputRef} className="hidden" accept=".zip" onChange={handleFileChange} />
                    
                    {state.zipFile ? (
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-green-500/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-3">
                                <FileCode className="w-6 h-6" />
                            </div>
                            <p className="text-slate-900 dark:text-white font-medium">{state.zipFile.name}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">{(state.zipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            <button onClick={(e) => { e.stopPropagation(); state.actions.setZipFile(null); }} className="mt-3 text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-1 hover:underline">
                                <X className="w-3 h-3" /> Remove file
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-gray-800 text-slate-400 dark:text-gray-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Upload className="w-5 h-5" />
                            </div>
                            <p className="text-slate-600 dark:text-gray-300 font-medium">Click to upload or drag .zip</p>
                        </>
                    )}
                </div>
            )}
            
            <div className="flex justify-end pt-6">
              <button 
                onClick={() => (state.sourceType === 'github' ? state.repoUrl : state.zipFile) && state.actions.setStep(2)}
                disabled={!(state.sourceType === 'github' ? state.repoUrl : state.zipFile)}
                className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:translate-x-1"
              >
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Configure AI Proxy */}
      {state.step === 2 && (
        <div className="glass-card rounded-2xl p-8 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <div>
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" /> AI Security Analysis
                 </h2>
                 <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">We'll scan your code and auto-inject a secure proxy configuration.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Input */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-slate-600 dark:text-gray-300 font-medium text-sm flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-slate-400 dark:text-gray-500" /> Source Code Sample
                    </h4>
                </div>
                <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                    <div className="absolute top-0 left-0 right-0 h-8 bg-slate-100 dark:bg-[#1e293b] flex items-center px-3 gap-2 border-b border-slate-200 dark:border-gray-700">
                        <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                        <span className="ml-2 text-xs text-slate-500 dark:text-gray-500 font-mono">src/api/client.ts</span>
                    </div>
                    <textarea 
                    value={state.sourceCode}
                    onChange={(e) => state.actions.setSourceCode(e.target.value)}
                    className="w-full h-48 bg-white dark:bg-[#020617] text-slate-800 dark:text-gray-300 p-4 pt-10 text-xs font-mono focus:outline-none resize-none leading-relaxed"
                    spellCheck="false"
                    />
                </div>
                <button 
                  onClick={() => presenter.deployment.handleAnalyzeCode()}
                  disabled={state.isAnalyzing}
                  className="mt-4 w-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm py-3 rounded-lg font-medium transition-all flex justify-center items-center gap-2 hover:border-brand-500/30"
                >
                  {state.isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin text-brand-600 dark:text-brand-400" /> : <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />}
                  {state.isAnalyzing ? 'AI Agent is analyzing...' : 'Analyze & Secure Code'}
                </button>
              </div>
            </div>

            {/* Right: Output Visualization */}
            <div className="relative flex flex-col h-full min-h-[300px]">
               <div className="absolute -inset-1 bg-gradient-to-b from-brand-500/20 to-purple-600/20 rounded-2xl blur-lg opacity-50"></div>
               <div className="relative flex-1 bg-[#0d1117] rounded-xl border border-gray-800 overflow-hidden flex flex-col">
                  {/* Editor Header */}
                  <div className="bg-[#161b22] px-4 py-2 flex items-center justify-between border-b border-gray-800">
                      <div className="flex gap-2">
                         <span className="text-xs text-brand-400 font-mono">diff --git a/client.ts b/client.ts</span>
                      </div>
                      {state.analyzedCode && <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20">SECURED</span>}
                  </div>

                  {/* Editor Body */}
                  <div className="relative flex-1 p-4 overflow-hidden font-mono text-xs">
                      {state.isAnalyzing && (
                        <div className="absolute inset-0 z-20 pointer-events-none">
                            <div className="w-full h-0.5 bg-brand-500 shadow-[0_0_15px_#0ea5e9] animate-scan opacity-80"></div>
                        </div>
                      )}
                      
                      {state.analyzedCode ? (
                         <div className="space-y-1 animate-fade-in">
                            <div className="text-gray-500 select-none">// GeminiDeploy Auto-Generated Proxy</div>
                            <pre className="text-green-300 whitespace-pre-wrap leading-relaxed">{state.analyzedCode}</pre>
                         </div>
                      ) : (
                         <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-3">
                            <Cpu className={`w-12 h-12 ${state.isAnalyzing ? 'text-brand-500 animate-pulse' : 'text-gray-700'}`} />
                            <p className="text-center max-w-[200px]">{state.isAnalyzing ? 'Identifying insecure patterns...' : 'Waiting for analysis...'}</p>
                         </div>
                      )}
                  </div>

                  {/* Explanation Footer */}
                  {state.explanation && (
                     <div className="bg-[#161b22]/90 backdrop-blur p-3 border-t border-gray-800 text-[11px] text-gray-400 animate-slide-up">
                        <span className="text-brand-400 font-bold">AI Note:</span> {state.explanation}
                     </div>
                  )}
               </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200 dark:border-white/5">
             <button onClick={() => state.actions.setStep(1)} className="text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white text-sm">Back</button>
             <button 
                onClick={handleDeployStart}
                disabled={!state.analyzedCode}
                className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-lg font-medium transition-all shadow-lg hover:shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 disabled:shadow-none"
              >
                <RocketIcon className="w-4 h-4" /> Start Deployment
              </button>
          </div>
        </div>
      )}

      {/* Step 3: Build & Deploy */}
      {state.step === 3 && (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
           <div className="bg-[#0d1117] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
             <div className="bg-[#161b22] px-6 py-4 border-b border-gray-800 flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${state.deploymentStatus === DeploymentStatus.SUCCESS ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-yellow-500 animate-pulse'}`}></div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-200">Build Log: {state.projectName}</h2>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{state.sourceType === 'github' ? state.repoUrl : state.zipFile?.name}</p>
                  </div>
               </div>
               {state.deploymentStatus === DeploymentStatus.BUILDING && (
                 <span className="px-3 py-1 bg-brand-500/10 text-brand-400 text-xs rounded-full border border-brand-500/20 flex items-center gap-2">
                   <Loader2 className="w-3 h-3 animate-spin" /> Compiling...
                 </span>
               )}
             </div>
             
             <Terminal logs={state.logs} className="min-h-[400px] border-none rounded-none" />
           </div>

           {state.deploymentStatus === DeploymentStatus.SUCCESS && (
             <div className="glass-card border-green-500/30 rounded-xl p-8 animate-slide-up flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-[100px] -z-10"></div>
               
               <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                        <Globe className="w-8 h-8" />
                   </div>
                   <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Deployment Live!</h3>
                        <a href={URLS.getDeploymentUrl(state.projectName)} target="_blank" rel="noreferrer" className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 font-mono text-sm flex items-center gap-2 hover:underline">
                        {URLS.getDeploymentUrl(state.projectName)} <ExternalLink className="w-3 h-3" />
                        </a>
                   </div>
               </div>
               
               <div className="flex gap-3">
                    <button onClick={() => window.open(URLS.getDeploymentUrl(state.projectName), '_blank')} className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-gray-200 transition-colors flex items-center gap-2">
                        Open App <ExternalLink className="w-4 h-4" />
                    </button>
                    <button onClick={() => presenter.ui.navigateTo('dashboard')} className="px-6 py-2 bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-white border border-slate-300 dark:border-white/10 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-white/10 transition-colors">
                        Back to Dashboard
                    </button>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

const RocketIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>
)
