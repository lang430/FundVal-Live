import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, AlertCircle, ArrowRight, User, Lock, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { register as apiRegister } from '../api/auth';

export default function Login() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(false);
  const { login } = useAuth();

  // Check registration setting
  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const response = await fetch('/api/auth/registration-enabled');
        if (response.ok) {
          const data = await response.json();
          setAllowRegistration(data.registration_enabled);
        }
      } catch (err) {
        console.error('Failed to check registration setting:', err);
      }
    };
    checkRegistration();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegisterMode) {
        if (password !== confirmPassword) {
            throw new Error('两次输入的密码不一致');
        }
        if (password.length < 6) {
            throw new Error('密码长度至少为 6 位');
        }
        await apiRegister(username, password);
        window.location.reload();
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err.message || (isRegisterMode ? '注册失败' : '登录失败'));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center relative overflow-hidden font-sans text-slate-100">
      
      {/* Background Ambience - "Awesome" Feature: Animated Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-500/20 rounded-full blur-[120px]" 
        />
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-blue-500/20 rounded-full blur-[120px]" 
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150 mix-blend-overlay"></div>

      <div className="relative z-10 w-full max-w-sm px-4">
        
        {/* Logo & Header */}
        <div 
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl shadow-blue-500/30 mb-6">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            FundVal Live
          </h1>
          <p className="text-slate-400 mt-2 text-sm tracking-wide">
            智能基金实时监控系统
          </p>
        </div>

        {/* Card */}
        <div 
          className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl ring-1 ring-white/10"
        >
          {error && (
            <div 
              className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">用户名</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-white pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-600"
                  placeholder="请输入用户名"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">密码</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-white pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-600"
                  placeholder="请输入密码"
                  required
                />
              </div>
            </div>

                {isRegisterMode && (
                <div 
                    className="overflow-hidden space-y-1"
                >
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">确认密码</label>
                    <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700/50 text-white pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-600"
                        placeholder="请再次输入密码"
                        required
                    />
                    </div>
                </div>
                )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegisterMode ? '立即注册' : '登 录'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Toggle */}
        <div 
            className="mt-8 text-center"
        >
          {allowRegistration ? (
            <p className="text-slate-400 text-sm">
              {isRegisterMode ? '已有账号？' : '还没有账号？'}
              <button
                onClick={toggleMode}
                className="ml-2 text-blue-400 hover:text-blue-300 font-medium hover:underline transition-colors"
              >
                {isRegisterMode ? '返回登录' : '立即注册'}
              </button>
            </p>
          ) : (
             !isRegisterMode && <p className="text-slate-600 text-xs">仅限授权用户访问</p>
          )}
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-700 font-mono">v1.2.9</div>
    </div>
  );
}
