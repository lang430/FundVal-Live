import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, AlertCircle, ArrowRight, User, Lock, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getRegistrationStatus, initAdmin, register as apiRegister } from '../api/auth';

export default function Login() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(false);
  const { login, checkAuth, needsInit } = useAuth();

  useEffect(() => {
    if (needsInit) {
      setAllowRegistration(false);
      setIsRegisterMode(false);
      return;
    }
    const load = async () => {
      try {
        const data = await getRegistrationStatus();
        const enabled = !!data.registration_enabled;
        setAllowRegistration(enabled);
        if (!enabled && isRegisterMode) setIsRegisterMode(false);
      } catch {
        setAllowRegistration(false);
        if (isRegisterMode) setIsRegisterMode(false);
      }
    };
    load();
  }, [isRegisterMode, needsInit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (needsInit) {
        await initAdmin(formData.username, formData.password);
        await checkAuth();
        return;
      }
      if (isRegisterMode) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('两次输入的密码不一致');
        }
        await apiRegister(formData.username, formData.password);
        await checkAuth();
      } else {
        await login(formData.username, formData.password);
      }
    } catch (err) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-slate-950 overflow-hidden font-sans">
      
      {/* Background Ambience - "Awesome" Feature: CSS Animated Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-yellow-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-pink-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        
        {/* Logo & Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl shadow-blue-500/30 mb-6 transform hover:scale-110 transition-transform duration-300">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {needsInit ? '初始化管理员' : 'FundVal Live'}
          </h1>
          <p className="text-slate-400 mt-2 text-sm tracking-wide">
            {needsInit ? '首次使用请先创建管理员账号' : '智能基金实时监控系统'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl ring-1 ring-white/10 animate-fade-in-up animation-delay-2000">
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">用户名</label>
                <div className="mt-1 relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    placeholder="请输入用户名"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">密码</label>
                <div className="mt-1 relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    placeholder="请输入密码"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

                {isRegisterMode && (
                <div className="space-y-1 animate-fade-in">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">确认密码</label>
                    <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                        type="password"
                        className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                        placeholder="请再次输入密码"
                        value={formData.confirmPassword}
                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                        required
                    />
                    </div>
                </div>
                )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/20 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {needsInit ? '创建管理员并进入系统' : (isRegisterMode ? '注册账户' : '登录')}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Toggle */}
        <div className="mt-8 text-center animate-fade-in animation-delay-4000">
          {!needsInit && allowRegistration ? (
            <p className="text-slate-400 text-sm">
              {isRegisterMode ? '已有账户？' : '还没有账户？'}
              <button
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setError('');
                  setFormData({ username: '', password: '', confirmPassword: '' });
                }}
                className="ml-2 font-medium text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center group"
              >
                {isRegisterMode ? (
                  <>
                    <LogIn className="w-4 h-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
                    立即登录
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-1 group-hover:translate-x-0.5 transition-transform" />
                    立即注册
                  </>
                )}
              </button>
            </p>
          ) : (
             !isRegisterMode && !needsInit && <p className="text-slate-600 text-xs">仅限授权用户访问</p>
          )}
        </div>
      </div>
      
      {/* Decorative Elements */}
    </div>
  );
}
