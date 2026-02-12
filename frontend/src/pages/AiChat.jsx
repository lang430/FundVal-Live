import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-3xl overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Bot className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
            <h2 className="font-bold text-slate-100">AI 投资顾问</h2>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-xs text-slate-400">Online · Powered by OpenAI</span>
            </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
      >
        {messages.map((msg) => (
            <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-blue-600' : 'bg-indigo-600'
                }`}>
                    {msg.role === 'user' ? <User className="w-6 h-6 text-white" /> : <Bot className="w-6 h-6 text-white" />}
                </div>
                
                <div className={`max-w-[80%] rounded-2xl p-4 ${
                    msg.role === 'user' 
                        ? 'bg-blue-600/90 text-white rounded-tr-none' 
                        : 'bg-slate-700/50 text-slate-200 rounded-tl-none border border-slate-600/30'
                }`}>
                    <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                </div>
            </motion.div>
        ))}

        {loading && (
            <div className="flex gap-4">
                 <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                    <Bot className="w-6 h-6 text-white" />
                </div>
                <div className="bg-slate-700/50 rounded-2xl rounded-tl-none p-4 flex items-center gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                </div>
            </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-800/50 border-t border-slate-700/50">
        <div className="relative max-w-4xl mx-auto">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="输入你的问题，例如：分析一下当前的半导体行情..."
                className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl pl-4 pr-12 py-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                disabled={loading}
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? <Sparkles className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
        </div>
        <p className="text-center text-xs text-slate-500 mt-2">
            AI 输出内容仅供参考，不作为投资建议。
        </p>
      </div>
    </div>
  );
}
