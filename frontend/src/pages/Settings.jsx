import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getPrompts, createPrompt, updatePrompt, deletePrompt, exportData, importData } from '../services/api';
import { PromptModal } from '../components/PromptModal';
import { ExportModal } from '../components/ExportModal';
import { ImportModal } from '../components/ImportModal';
import { AISettings } from './Settings/AISettings';
import { EmailSettings } from './Settings/EmailSettings';
import { PromptManagement } from './Settings/PromptManagement';
import { DataManagement } from './Settings/DataManagement';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [settings, setSettings] = useState({
    OPENAI_API_KEY: '',
    OPENAI_API_BASE: '',
    AI_MODEL_NAME: '',
    SMTP_HOST: '',
    SMTP_PORT: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    EMAIL_FROM: '',
    INTRADAY_COLLECT_INTERVAL: '5'
  });

  const [errors, setErrors] = useState({});

  // AI Prompts state
  const [prompts, setPrompts] = useState([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);

  // Import/Export state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    loadPrompts();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();

      setSettings(data.settings || {});
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (settings.SMTP_USER && !emailRegex.test(settings.SMTP_USER)) {
      newErrors.SMTP_USER = '邮箱格式不正确';
    }
    if (settings.EMAIL_FROM && !emailRegex.test(settings.EMAIL_FROM)) {
      newErrors.EMAIL_FROM = '邮箱格式不正确';
    }

    // Port validation
    const port = parseInt(settings.SMTP_PORT);
    if (settings.SMTP_PORT && (isNaN(port) || port < 1 || port > 65535)) {
      newErrors.SMTP_PORT = '端口必须在 1-65535 之间';
    }

    // Interval validation
    const interval = parseInt(settings.INTRADAY_COLLECT_INTERVAL);
    if (settings.INTRADAY_COLLECT_INTERVAL && (isNaN(interval) || interval < 1 || interval > 60)) {
      newErrors.INTRADAY_COLLECT_INTERVAL = '采集间隔必须在 1-60 分钟之间';
    }

    // URL validation
    if (settings.OPENAI_API_BASE) {
      try {
        new URL(settings.OPENAI_API_BASE);
      } catch {
        newErrors.OPENAI_API_BASE = 'URL 格式不正确';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setMessage({ type: 'error', text: '请修正表单错误' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      // 过滤掉掩码字段
      const filteredSettings = Object.fromEntries(
        Object.entries(settings).filter(([key, value]) => value !== '***')
      );

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: filteredSettings })
      });

      if (!response.ok) {
        const errorData = await response.json();

        // 如果后端返回字段级错误
        if (errorData.detail && errorData.detail.errors) {
          setErrors(errorData.detail.errors);
          setMessage({ type: 'error', text: '请修正表单错误' });
        } else {
          setMessage({ type: 'error', text: '保存失败' });
        }
        return;
      }

      setMessage({ type: 'success', text: '设置已保存' });
    } catch (error) {
      setMessage({ type: 'error', text: '网络错误' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // AI Prompts functions
  const loadPrompts = async () => {
    setPromptsLoading(true);
    try {
      const data = await getPrompts();
      setPrompts(data);
    } catch (error) {
      console.error('Load prompts failed', error);
    } finally {
      setPromptsLoading(false);
    }
  };

  const handleCreatePrompt = () => {
    setEditingPrompt(null);
    setPromptModalOpen(true);
  };

  const handleEditPrompt = (prompt) => {
    setEditingPrompt(prompt);
    setPromptModalOpen(true);
  };

  const handleSavePrompt = async (data) => {
    try {
      if (editingPrompt) {
        await updatePrompt(editingPrompt.id, data);
        setMessage({ type: 'success', text: '模板已更新' });
      } else {
        await createPrompt(data);
        setMessage({ type: 'success', text: '模板已创建' });
      }
      await loadPrompts();
    } catch (error) {
      throw error;
    }
  };

  const handleDeletePrompt = async (id) => {
    if (!confirm('确定要删除这个提示词模板吗？')) return;

    try {
      await deletePrompt(id);
      setMessage({ type: 'success', text: '模板已删除' });
      await loadPrompts();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || '删除失败';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  const handleSetDefault = async (prompt) => {
    try {
      // Pass complete prompt data to satisfy backend validation
      await updatePrompt(prompt.id, {
        name: prompt.name,
        system_prompt: prompt.system_prompt,
        user_prompt: prompt.user_prompt,
        is_default: true
      });
      setMessage({ type: 'success', text: '已设为默认模板' });
      await loadPrompts();
    } catch (error) {
      setMessage({ type: 'error', text: '设置失败' });
    }
  };

  const handleImportSuccess = () => {
    setMessage({ type: 'success', text: '数据导入成功' });
    // 重新加载数据
    loadSettings();
    loadPrompts();
  };

  const handleExport = async (modules) => {
    try {
      await exportData(modules);
    } catch (error) {
      throw error;
    }
  };

  const handleImport = async (data, modules, mode) => {
    try {
      const response = await importData(data, modules, mode);
      handleImportSuccess();
      return response;
    } catch (error) {
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载设置中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? '保存中...' : '保存更改'}
        </button>
      </div>

      {message.text && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* AI Configuration */}
      <AISettings settings={settings} errors={errors} onChange={handleChange} />

      {/* Email Configuration */}
      <EmailSettings settings={settings} errors={errors} onChange={handleChange} />

      {/* AI Prompts Management */}
      <PromptManagement
        prompts={prompts}
        loading={promptsLoading}
        onCreatePrompt={handleCreatePrompt}
        onEditPrompt={handleEditPrompt}
        onDeletePrompt={handleDeletePrompt}
        onSetDefault={handleSetDefault}
      />

      {/* Data Import/Export */}
      <DataManagement
        onExport={() => setExportModalOpen(true)}
        onImport={() => setImportModalOpen(true)}
      />

      {/* Prompt Modal */}
      <PromptModal
        isOpen={promptModalOpen}
        onClose={() => setPromptModalOpen(false)}
        onSave={handleSavePrompt}
        prompt={editingPrompt}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
}
