import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import { analyzeFundAI } from '../services/api';

export default function AiChat({ accountId }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '你好！我是你的专属 AI 基金分析师。我可以帮你分析持仓基金、解读市场趋势或评估投资机会。\n\n你可以试着问我：\n- 分析一下易方达蓝筹精选最近的表现\n- 我的组合风险怎么样？\n- 现在的市场适合加仓吗？'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { id: Date.now(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Direct chat is not yet fully implemented in backend, simulating analysis for a specific fund for demo
      // In a real chat app, we'd call a chat endpoint. Here we'll map common queries to the analyze endpoint if possible,
      // or give a generic response.
      
      // Smart detection (mock logic for demo purposes)
      let responseContent = '';
      
      if (input.includes('分析') || input.includes('怎么样')) {
          // If we could detect a fund code, we'd call analyzeFundAI. 
          // For now, let's simulate a thinking process
          await new Promise(r => setTimeout(r, 1500));
          responseContent = "根据最新的市场数据，目前该板块处于震荡调整期。建议关注长期均线的支撑情况，控制仓位风险。对于科技成长类基金，近期波动较大，适合定投分批介入。";
      } else {
          await new Promise(r => setTimeout(r, 1000));
          responseContent = "收到。作为一个专注于基金数据的 AI 助手，我建议你关注最新的财报数据和宏观政策变化。需要我为你深入分析特定的基金吗？";
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: responseContent
      }]);

    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: '抱歉，我的连接似乎出了点问题，请稍后再试。'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-100 bg-white/50 flex items-center gap-3 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
            <h2 className="font-bold text-slate-800">AI 投资顾问</h2>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                <span className="text-xs text-slate-500 font-medium">Online · Powered by OpenAI</span>
            </div>
        </div>
        <div className="ml-auto">
            <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Pro
            </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50"
      >
        {messages.map((msg) => (
            <div
                key={msg.id}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group`}
            >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md ${
                    msg.role === 'user' 
                        ? 'bg-blue-600 shadow-blue-500/20' 
                        : 'bg-white border border-slate-100'
                }`}>
                    {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-indigo-600" />}
                </div>
                
                <div className={`max-w-[80%] rounded-2xl p-5 shadow-sm ${
                    msg.role === 'user' 
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none shadow-blue-500/20' 
                        : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-slate-200/50'
                }`}>
                    <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                </div>
            </div>
        ))}

        {loading && (
            <div className="flex gap-4">
                 <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-md">
                    <Bot className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-none p-4 flex items-center gap-1 shadow-sm border border-slate-100">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                </div>
            </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100 relative z-10">
        <div className="relative max-w-4xl mx-auto shadow-lg shadow-slate-200/50 rounded-2xl">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="输入你的问题，例如：分析一下当前的半导体行情..."
                className="w-full bg-white border border-slate-200 rounded-2xl pl-5 pr-14 py-4 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                disabled={loading}
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
            >
                {loading ? <Sparkles className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
        </div>
        <p className="text-center text-xs text-slate-400 mt-3 font-medium">
            AI 输出内容仅供参考，不作为投资建议。
        </p>
      </div>
    </div>
  );
}
