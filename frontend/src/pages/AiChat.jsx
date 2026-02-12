import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';

import ReactMarkdown from 'react-markdown';

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

    const now = Date.now();
    const userMsg = { id: now, role: 'user', content: input };
    const assistantMsgId = now + 1;
    setMessages(prev => [...prev, userMsg, { id: assistantMsgId, role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const systemPrompt = `你是 FundVal Live 的 AI 投资顾问，专注于基金与资产配置。请用简体中文回答，结构清晰，给出风险提示。用户当前 account_id=${accountId ?? 'unknown'}。`;
      const requestMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
          .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
          .map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMsg.content },
      ];

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          messages: requestMessages,
          stream: true,
        }),
      });

      if (!res.ok) {
        let detail = '';
        try {
          const data = await res.json();
          detail = data?.detail || '';
        } catch {
          detail = await res.text();
        }
        throw new Error(detail || 'AI 服务请求失败');
      }

      if (!res.body) {
        throw new Error('AI 流式响应不可用');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const boundary = buffer.indexOf('\n\n');
          if (boundary === -1) break;

          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          const lines = chunk.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload) continue;
            if (payload === '[DONE]') {
              done = true;
              break;
            }

            let json;
            try {
              json = JSON.parse(payload);
            } catch {
              continue;
            }

            const delta =
              json?.choices?.[0]?.delta?.content ??
              json?.choices?.[0]?.message?.content ??
              '';

            if (delta) {
              assistantText += delta;
              setMessages(prev =>
                prev.map(m => (m.id === assistantMsgId ? { ...m, content: assistantText } : m))
              );
            }
          }
          if (done) break;
        }
      }

    } catch (e) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: e?.message || '抱歉，我的连接似乎出了点问题，请稍后再试。' }
            : m
        )
      );
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
                <span className="text-xs text-slate-500 font-medium">Online · Powered by NVIDIA</span>
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
