
import React, { useState, useRef, useEffect } from 'react';
import { ToneType, ChatMessage, AnalysisResult, AutoLog } from './types';
import { analyzeChatContent } from './services/geminiService';
import { ReplyCard } from './components/ReplyCard';

const PYTHON_SCRIPT = `import pyperclip
import pyautogui
import time
import sys

# 依赖安装提示: pip install pyperclip pyautogui pygetwindow

PREFIX = "::WX_SEND::"
# 浏览器拦截层的核心背景色 (Indigo-700: RGB 67, 56, 202)
OVERLAY_COLOR = (67, 56, 202) 

def check_browser_overlay():
    """监控屏幕，如果发现出现了授权拦截页面，则模拟点击以恢复同步"""
    try:
        sw, sh = pyautogui.size()
        cx, cy = sw // 2, sh // 2
        
        # 多点校验，确保是我们的授权页面而不是其他蓝色背景
        check_points = [
            (cx, cy),           # 中心
            (cx - 200, cy),     # 左侧
            (cx + 200, cy),     # 右侧
            (cx, cy - 150)      # 上方
        ]
        
        matches = 0
        for px, py in check_points:
            if pyautogui.pixelMatchesColor(px, py, OVERLAY_COLOR, tolerance=25):
                matches += 1
        
        if matches >= 3:
            print(f"[{time.strftime('%H:%M:%S')}] 🛡️ 检测到浏览器授权页，执行精准激活...")
            pyautogui.click(cx, cy)
            return True
    except Exception:
        pass
    return False

def activate_wechat():
    """尝试自动寻找并激活微信窗口"""
    try:
        if sys.platform == 'win32':
            import pygetwindow as gw
            titles_to_try = ['张燕', '微信', 'WeChat']
            for title in titles_to_try:
                wins = gw.getWindowsWithTitle(title)
                if wins:
                    win = wins[0]
                    if win.isMinimized:
                        win.restore()
                    win.activate()
                    return True
            
            all_titles = gw.getAllTitles()
            for t in all_titles:
                if any(k in t for k in ['微信', 'WeChat', '张燕']):
                    wins = gw.getWindowsWithTitle(t)
                    if wins:
                        win = wins[0]
                        if win.isMinimized:
                            win.restore()
                        win.activate()
                        return True
                        
        elif sys.platform == 'darwin': # MacOS
            import os
            os.system("open -a 'WeChat'")
            return True
    except Exception as e:
        print(f"窗口激活失败: {e}")
    return False

def main():
    print("="*60)
    print("      WX.Agent Pro 自动化引擎 (v4.8 定时激活版)      ")
    print("="*60)
    print("功能：自动监听 + 窗口激活 + 每5秒自动点击屏幕激活")
    print("状态: 监控中...")
    
    last_content = ""
    last_timer_click = time.time()
    
    while True:
        try:
            current_time = time.time()
            
            # 每 5 秒强制点击一次屏幕中心 (用于激活浏览器授权)
            if current_time - last_timer_click >= 5:
                sw, sh = pyautogui.size()
                # 记录当前位置，点完再回来，减少对用户操作的干扰
                old_x, old_y = pyautogui.position()
                pyautogui.click(sw // 2, sh // 2)
                pyautogui.moveTo(old_x, old_y)
                print(f"[{time.strftime('%H:%M:%S')}] ⚡ 定时激活点击已执行")
                last_timer_click = current_time

            # 同时保留颜色检测逻辑作为双重保障
            check_browser_overlay()

            content = pyperclip.paste()
            
            if content and content.startswith(PREFIX) and content != last_content:
                msg = content[len(PREFIX):]
                print(f"[{time.strftime('%H:%M:%S')}] 🚀 捕获到新指令...")
                
                pyperclip.copy(msg)
                time.sleep(0.1)
                
                if activate_wechat():
                    print(f"[{time.strftime('%H:%M:%S')}] 🎯 微信窗口就绪")
                    time.sleep(0.4)
                
                cmd_key = 'command' if sys.platform == 'darwin' else 'ctrl'
                pyautogui.hotkey(cmd_key, 'v')
                time.sleep(0.3)
                pyautogui.press('enter')
                
                print(f"[{time.strftime('%H:%M:%S')}] ✅ 发送完成")
                
                pyperclip.copy("")
                last_content = ""
            
            time.sleep(0.5)
            
        except KeyboardInterrupt:
            print("\\n程序退出。")
            break
        except Exception as e:
            print(f"异常: {e}")
            time.sleep(2)

if __name__ == "__main__":
    main()
`;

const App: React.FC = () => {
  const [isAutoPilot, setIsAutoPilot] = useState(true); 
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logs, setLogs] = useState<AutoLog[]>([]);
  const [selectedTone, setSelectedTone] = useState<ToneType>(ToneType.PROFESSIONAL);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3-flash-preview');
  const [scanCountdown, setScanCountdown] = useState(5);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'checking' | 'active' | 'error'>('idle');
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countdownTimer = useRef<number | null>(null);

  const CLIPBOARD_PREFIX = '::WX_SEND::';
  const SCAN_INTERVAL_SEC = 5;

  const lastProcessedFriendMsgRef = useRef<string>('');
  const hasRepliedToCurrentMsgRef = useRef<boolean>(false);
  const pendingAutoReplyRef = useRef<string | null>(null);

  useEffect(() => {
    const initKeyCheck = async () => {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          addLog('提示：未检测到 API 密钥，请在设置中配置', 'pending');
        } else {
          setApiStatus('active');
        }
      } catch (e) {
        console.debug('Initial key check skipped');
      }
    };
    initKeyCheck();
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      addLog('信号源锁定：视窗捕获中', 'success');
      checkApi();
    }
  }, [stream]);

  useEffect(() => {
    if (stream && !isQuotaExceeded) {
      countdownTimer.current = window.setInterval(() => {
        setScanCountdown(prev => {
          if (prev <= 1) {
            performVisionScan();
            return SCAN_INTERVAL_SEC;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      setScanCountdown(SCAN_INTERVAL_SEC);
    }
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [stream, isQuotaExceeded, isAutoPilot, selectedTone, selectedModel]);

  const addLog = (event: string, status: 'success' | 'pending' | 'error' = 'success') => {
    setLogs(prev => [{ id: Date.now().toString(), time: new Date(), event, status }, ...prev].slice(0, 50));
  };

  const checkApi = async () => {
    setApiStatus('checking');
    try {
      await analyzeChatContent("Ping", selectedTone, false, selectedModel);
      setApiStatus('active');
    } catch (e: any) {
      setApiStatus('error');
    }
  };

  const handleChangeApiKey = async () => {
    try {
      await window.aistudio.openSelectKey();
      addLog('API 密钥配置已启动', 'success');
      setApiStatus('active');
      checkApi(); 
    } catch (err) {
      addLog('无法打开密钥选择器', 'error');
    }
  };

  const copyPythonScript = async () => {
    try {
      await navigator.clipboard.writeText(PYTHON_SCRIPT);
      addLog('已复制增强版脚本，支持每5秒自动点击激活', 'success');
    } catch (err) {
      addLog('脚本复制失败', 'error');
    }
  };

  const performVisionScan = async () => {
    if (!stream || isAnalyzing) return;
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    if (video.videoWidth === 0) return;

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.4);

    setIsAnalyzing(true);
    
    try {
      const result = await analyzeChatContent(base64, selectedTone, true, selectedModel);
      
      // 检测到新消息内容，重置回复标记
      if (result.lastFriendMessage !== lastProcessedFriendMsgRef.current) {
        lastProcessedFriendMsgRef.current = result.lastFriendMessage;
        hasRepliedToCurrentMsgRef.current = false;
      }

      setAnalysis(result);

      if (result.detectedTone && result.detectedTone !== selectedTone) {
        setSelectedTone(result.detectedTone as ToneType);
      }

      // 核心逻辑：对方没发新消息，且我已经回复过这一条，则不再回复
      if (result.shouldReply) {
        if (hasRepliedToCurrentMsgRef.current) {
          console.debug('针对当前消息已完成回复，等待对方新动态...');
          return;
        }

        addLog(`🧠 AI 自动切换：${result.explanation}`, 'success');
        
        if (isAutoPilot) {
          addLog(`执行自动回复...`, 'pending');
          await handleSendMessage(result.bestReply, true);
          // 标记针对此消息已完成回复
          hasRepliedToCurrentMsgRef.current = true;
        } else {
          addLog(`AI 回复建议已就绪`, 'success');
        }
      }
    } catch (error: any) {
      addLog('视觉扫描失败，请检查网络', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async (content: string, isAuto: boolean = false) => {
    if (!content.trim()) return;
    const protocolContent = `${CLIPBOARD_PREFIX}${content}`;
    try {
      await navigator.clipboard.writeText(protocolContent);
      addLog(isAuto ? `🤖 自动化指令已送达本地` : `👤 手动指令已送达本地`, 'success');
      setNeedsInteraction(false);
      pendingAutoReplyRef.current = null;
    } catch (e: any) {
      if (isAuto) {
        setNeedsInteraction(true);
        pendingAutoReplyRef.current = content;
        addLog('🛡️ 拦截页已出现，本地脚本正在尝试点击...', 'error');
      } else {
        addLog('同步数据失败', 'error');
      }
    }
  };

  const handlePageClick = () => {
    if (needsInteraction && pendingAutoReplyRef.current) {
      addLog('鼠标辅助激活成功', 'pending');
      handleSendMessage(pendingAutoReplyRef.current, true);
    }
  };

  const startCapture = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any });
      mediaStream.getVideoTracks()[0].onended = () => stopCapture();
      setStream(mediaStream);
      addLog('视窗捕获服务启动', 'success');
    } catch (err) {
      addLog('视窗共享已取消', 'error');
    }
  };

  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setAnalysis(null);
      lastProcessedFriendMsgRef.current = ''; 
      hasRepliedToCurrentMsgRef.current = false;
      addLog('监控挂起', 'pending');
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden relative"
      onClick={handlePageClick}
    >
      {needsInteraction && (
        <div className="fixed inset-0 z-[100] bg-indigo-700/95 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-white text-center cursor-pointer">
          <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-8 animate-pulse border border-white/20">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"></path></svg>
          </div>
          <h2 className="text-4xl font-black mb-4 tracking-tighter">等待自动化授权</h2>
          <p className="max-w-md text-indigo-100 mb-10 text-lg leading-relaxed font-medium">脚本正在尝试辅助点击。如果未成功，请手动点击任意位置。</p>
          <div className="px-14 py-5 bg-white text-indigo-700 rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">立即激活</div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-10 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-green-100">W</div>
          <h1 className="text-xl font-black tracking-tight text-slate-800">WX.Agent <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md ml-1 uppercase">v4.7 PRO</span></h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100">
            <span className={`w-3 h-3 rounded-full ${apiStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></span>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{apiStatus === 'active' ? 'AI 协议激活' : '离线状态'}</span>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 hover:bg-slate-100 rounded-2xl text-slate-500 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg></button>
        </div>
      </header>

      <div className={`fixed inset-0 z-50 transition-all duration-500 ${isSettingsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
        <div className={`absolute top-0 right-0 h-full w-[24rem] bg-white shadow-2xl transition-transform duration-500 transform ${isSettingsOpen ? 'translate-x-0' : 'translate-x-full'} p-12 flex flex-col`}>
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-2xl font-black tracking-tighter">自动化配置</h2>
            <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          </div>
          <div className="space-y-12 flex-1 overflow-y-auto pr-2 scrollbar-hide">
            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">服务凭证</h3>
              <button onClick={handleChangeApiKey} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-50">重置密钥</button>
            </section>
            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">全自动化引擎 (V4.7)</h3>
              <p className="text-[11px] text-slate-500 mb-6 leading-relaxed font-medium">定时激活点击与颜色检测双重保障。请确保您的微信窗口未最小化。</p>
              <button onClick={copyPythonScript} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs hover:bg-black transition-all shadow-2xl flex items-center justify-center gap-3"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>复制 V4.7 引擎脚本</button>
            </section>
            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">逻辑大脑模型</h3>
              <div className="space-y-4">
                {[{ id: 'gemini-3-flash-preview', name: 'Flash 4.0 - 极速回复' }, { id: 'gemini-3-pro-preview', name: 'Pro 4.0 - 深度洞察' }].map(m => (
                  <button key={m.id} onClick={() => setSelectedModel(m.id)} className={`w-full p-6 rounded-3xl border-2 text-left transition-all ${selectedModel === m.id ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                    <p className={`text-[13px] font-black ${selectedModel === m.id ? 'text-indigo-700' : 'text-slate-700'}`}>{m.name}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-12 max-w-[100rem] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-8 space-y-12">
           <div className="bg-slate-900 rounded-[3.5rem] overflow-hidden shadow-2xl aspect-video relative border-[16px] border-white group">
              {!stream ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-10 text-center p-20">
                   <div className="w-32 h-32 bg-indigo-500/20 rounded-[2.5rem] flex items-center justify-center text-indigo-400 animate-pulse border border-white/10"><svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></div>
                   <div className="space-y-4">
                     <h3 className="text-4xl font-black tracking-tighter">微信监控准备就绪</h3>
                     <p className="text-slate-400 font-bold text-lg">关联微信视窗，开启 AI 社交大脑</p>
                   </div>
                   <button onClick={startCapture} className="px-16 py-6 bg-indigo-600 hover:bg-indigo-700 rounded-3xl font-black text-sm uppercase tracking-[0.2em] transition-all shadow-2xl hover:scale-105">启动实时监控</button>
                </div>
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                  <div className="absolute top-12 right-12 flex gap-6">
                    {isAnalyzing && <div className="bg-black/40 backdrop-blur-2xl px-7 py-4 rounded-[1.5rem] text-white text-[12px] font-black uppercase flex items-center gap-4 border border-white/20"><span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-ping"></span>情绪解析中</div>}
                    <button onClick={stopCapture} className="bg-white/95 hover:bg-rose-500 hover:text-white px-7 py-4 rounded-[1.5rem] text-slate-900 text-[12px] font-black uppercase flex items-center gap-4 shadow-2xl transition-all backdrop-blur-md">运行中 ({scanCountdown}s) | 停止</button>
                  </div>
                </>
              )}
           </div>

           {analysis && (
              <div className="bg-white rounded-[3.5rem] p-16 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-16 duration-1000">
                 <div className="flex items-center justify-between mb-16">
                    <h2 className="text-4xl font-black tracking-tighter flex items-center gap-6"><div className="w-5 h-16 bg-indigo-600 rounded-3xl"></div>决策中心</h2>
                    <div className="bg-indigo-50 px-6 py-3 rounded-2xl text-indigo-700 font-black text-base border border-indigo-100">{analysis.confidence}% 匹配</div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-16">
                    <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5">当前感知情绪</p><p className="text-3xl font-black text-slate-800 tracking-tight">{analysis.emotionalTone}</p></div>
                    <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100"><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5">最后对话内容</p><p className="text-lg italic text-slate-600 leading-relaxed font-bold">"{analysis.lastFriendMessage || '等待中...'}"</p></div>
                 </div>
                 <div className="space-y-10">
                    <ReplyCard suggestion={{ text: analysis.bestReply, explanation: analysis.explanation }} onSelect={(text) => handleSendMessage(text)} />
                    {isAutoPilot && (
                       <div className="px-10 py-6 bg-emerald-50 text-emerald-700 rounded-[2rem] text-base font-black flex items-center gap-5 border border-emerald-100 shadow-sm">
                         <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shrink-0"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg></div>
                         <span>已切换人格并推送回复，自动化脚本接管中...</span>
                       </div>
                    )}
                 </div>
              </div>
           )}
        </div>

        <div className="lg:col-span-4 space-y-16">
           <div className="bg-white rounded-[3.5rem] p-12 shadow-sm border border-slate-100">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-12">人格风格配置</h2>
              <div className="space-y-16">
                <div>
                   <label className="text-[13px] font-black text-slate-500 mb-8 block">预设模拟人格 (AI 会自动切换并高亮)</label>
                   <div className="space-y-4">
                     {Object.values(ToneType).map(t => (
                       <button key={t} onClick={() => setSelectedTone(t)} className={`w-full px-10 py-6 rounded-3xl text-base font-black text-left flex items-center justify-between transition-all ${selectedTone === t ? 'bg-indigo-600 text-white shadow-2xl translate-x-1.5' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                         {t}
                         {selectedTone === t && <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping"></div>}
                       </button>
                     ))}
                   </div>
                </div>
                <div className="pt-12 border-t border-slate-100">
                   <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-black tracking-tighter">完全自动驾驶</h3>
                        <p className="text-[12px] text-slate-400 mt-2 font-bold uppercase tracking-widest">零感自动同步</p>
                      </div>
                      <button onClick={() => setIsAutoPilot(!isAutoPilot)} className={`w-20 h-11 rounded-full transition-all relative p-1.5 ${isAutoPilot ? 'bg-green-500 shadow-xl' : 'bg-slate-200'}`}><div className={`w-8 h-8 bg-white rounded-full shadow-md transition-all transform ${isAutoPilot ? 'translate-x-9' : 'translate-x-0'}`}></div></button>
                   </div>
                </div>
              </div>
           </div>

           <div className="bg-slate-900 rounded-[3.5rem] p-12 shadow-2xl h-[36rem] flex flex-col border border-white/5">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">后台引擎日志</h2>
                <div className="flex gap-2.5">
                   <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                   <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-6 font-mono text-[12px] pr-3 scrollbar-hide">
                 {logs.map(l => (
                    <div key={l.id} className="flex gap-5 leading-relaxed group border-l border-slate-800 pl-4">
                       <span className="text-slate-600 shrink-0 select-none group-hover:text-slate-400 transition-colors italic">[{l.time.toLocaleTimeString([], { hour12: false })}]</span>
                       <span className={l.status === 'error' ? 'text-rose-400 font-bold' : l.status === 'success' ? 'text-emerald-400' : 'text-sky-400'}>{l.event}</span>
                    </div>
                 ))}
                 {logs.length === 0 && <div className="text-slate-700 font-bold opacity-30 italic">系统就绪，等待数据...</div>}
              </div>
           </div>
        </div>
      </main>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
