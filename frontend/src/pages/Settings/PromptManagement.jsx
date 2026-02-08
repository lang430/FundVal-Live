import React from 'react';
import { Plus, Edit2, Trash2, Star } from 'lucide-react';

export function PromptManagement({
  prompts,
  loading,
  onCreatePrompt,
  onEditPrompt,
  onDeletePrompt,
  onSetDefault
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">AI 提示词管理</h2>
        <button
          onClick={onCreatePrompt}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建模板
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">暂无提示词模板</div>
      ) : (
        <div className="grid gap-4">
          {prompts.map(prompt => (
            <div
              key={prompt.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{prompt.name}</h3>
                    {prompt.is_default && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        默认
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    创建于 {new Date(prompt.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!prompt.is_default && (
                    <button
                      onClick={() => onSetDefault(prompt)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="设为默认"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onEditPrompt(prompt)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeletePrompt(prompt.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="删除"
                    disabled={prompt.is_default}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
