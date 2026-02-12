import React, { useState, useRef } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, ArrowUpDown, ChevronDown, Download, CheckCircle, Clock } from 'lucide-react';
import { getRateColor } from '../components/StatCard';
import { PortfolioChart } from '../components/PortfolioChart';
import { useAccountData } from '../hooks/useAccountData';
import { usePositions, SORT_OPTIONS } from '../hooks/usePositions';
import { PositionModal, AddPositionModal, ReducePositionModal } from '../components/TradeModal';

const Account = ({ currentAccount = 1, onSelectFund, onPositionChange, onSyncWatchlist, syncLoading, isActive }) => {
  // 数据管理
  const { data, loading, error, refetch } = useAccountData(currentAccount, isActive);

  // 持仓操作管理
  const {
    sortOption,
    setSortOption,
    sortPositions,
    submitting,
    navUpdating,
    syncLoading: positionSyncLoading,
    handleUpdatePosition,
    handleDeletePosition,
    handleAddPosition,
    handleReducePosition,
    handleUpdateNav,
    handleSyncWatchlist
  } = usePositions(currentAccount, onPositionChange, onSyncWatchlist, refetch);

  // UI 状态
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [addModalPos, setAddModalPos] = useState(null);
  const [reduceModalPos, setReduceModalPos] = useState(null);

  const sortDropdownRef = useRef(null);

  // 是否为汇总视图
  const isAggregatedView = currentAccount === 0;

  const { summary, positions } = data;
  const displayPositions = positions || [];

  // 分类筛选
  const CATEGORIES = ['全部', '货币类', '偏债类', '偏股类', '商品类', '未分类'];

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === '全部'
      ? displayPositions.length
      : displayPositions.filter(p => p.category === cat).length;
    return acc;
  }, {});

  const filteredPositions = selectedCategory === '全部'
    ? displayPositions
    : displayPositions.filter(p => p.category === selectedCategory);

  const sortedPositions = sortPositions(filteredPositions);

  // Modal 操作
  const handleOpenModal = (pos = null) => {
    setEditingPos(pos);
    setModalOpen(true);
  };

  const handleSubmitPosition = async (formData) => {
    try {
      await handleUpdatePosition(formData);
      setModalOpen(false);
    } catch (e) {
      alert('保存失败');
    }
  };

  const handleSync = () => {
    handleSyncWatchlist(positions);
  };

  const handleSortChange = (option) => {
    setSortOption(option);
    setSortDropdownOpen(false);
  };

  // 点击外部关闭下拉菜单
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Aggregated View Notice */}
      {isAggregatedView && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
             <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 text-sm">正在查看全部账户汇总</h3>
            <p className="text-sm text-blue-700 mt-1">
              相同基金的持仓已自动合并（份额相加，成本加权平均）。汇总视图仅供查看，不支持修改操作。
            </p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="text-red-500 bg-red-100 p-2 rounded-lg">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">{error}</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {/* Portfolio Overview */}
      {loading && !data.positions.length ? (
        <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-1/3 mb-6"></div>
          <div className="h-48 bg-slate-100 rounded-2xl mb-6"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-slate-100 rounded-2xl"></div>
            <div className="h-24 bg-slate-100 rounded-2xl"></div>
            <div className="h-24 bg-slate-100 rounded-2xl"></div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <PortfolioChart positions={positions} summary={summary} loading={loading} onRefresh={refetch} />
        </div>
      )}

      {/* Actions */}
      <div className="space-y-4">
        {/* 第一行：标题 + 操作按钮 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            {isAggregatedView ? '全部账户持仓汇总' : '持仓明细'}
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {displayPositions.length} 只基金
            </span>
          </h2>
          <div className="flex gap-2 flex-wrap">
            {/* 排序下拉菜单 */}
            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 px-4 py-2 rounded-xl transition-all text-sm font-medium shadow-sm hover:shadow-md"
              >
                <ArrowUpDown className="w-4 h-4" />
                排序
                <ChevronDown className={`w-3 h-3 transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {sortDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {SORT_OPTIONS.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleSortChange(option)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        sortOption.label === option.label
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSync}
              disabled={syncLoading || positionSyncLoading}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 px-4 py-2 rounded-xl transition-all text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title="将持仓基金添加到关注列表"
            >
              <RefreshCw className={`w-4 h-4 ${(syncLoading || positionSyncLoading) ? 'animate-spin' : ''}`} />
              {(syncLoading || positionSyncLoading) ? '同步中...' : '同步关注'}
            </button>
            <button
              onClick={handleUpdateNav}
              disabled={navUpdating}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50/50 px-4 py-2 rounded-xl transition-all text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title="手动更新所有持仓基金的净值"
            >
              <Download className={`w-4 h-4 ${navUpdating ? 'animate-spin' : ''}`} />
              {navUpdating ? '更新中...' : '更新净值'}
            </button>
            {!isAggregatedView && (
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl transition-all text-sm font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                记一笔
              </button>
            )}
          </div>
        </div>

        {/* 第二行：分类筛选器 */}
        <div className="flex gap-1 bg-white p-1 rounded-xl w-fit border border-slate-200 shadow-sm">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {cat} <span className={`ml-1 text-xs ${selectedCategory === cat ? 'text-blue-200' : 'text-slate-400'}`}>({categoryCounts[cat]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-100 overflow-hidden">
        <div>
          <table className="w-full text-base text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 font-bold text-xs uppercase tracking-wider sticky top-[73px] z-30 shadow-sm backdrop-blur-md">
              <tr>
                <th className="px-5 py-4 text-left border-b border-slate-200">
                  <div>基金信息</div>
                  <div className="text-[10px] text-slate-400 normal-case mt-0.5 font-normal">持有总收益%</div>
                </th>
                <th className="px-5 py-4 text-right border-b border-slate-200">
                  <div>预估净值</div>
                  <div className="text-[10px] text-slate-400 normal-case mt-0.5 font-normal">昨日净值</div>
                </th>
                <th className="px-5 py-4 text-right border-b border-slate-200">
                  <div>预估收益</div>
                  <div className="text-[10px] text-slate-400 normal-case mt-0.5 font-normal">涨跌%</div>
                </th>
                <th className="px-5 py-4 text-right border-b border-slate-200">
                  <div>持有总值</div>
                  <div className="text-[10px] text-slate-400 normal-case mt-0.5 font-normal">持有收益</div>
                </th>
                <th className="px-5 py-4 text-right border-b border-slate-200">
                  <div>份额</div>
                  <div className="text-[10px] text-slate-400 normal-case mt-0.5 font-normal">成本</div>
                </th>
                <th className="px-5 py-4 text-right border-b border-slate-200">
                  <div>预估总收益</div>
                  <div className="text-[10px] text-slate-400 normal-case mt-0.5 font-normal">预估总收益%</div>
                </th>
                <th className="px-5 py-4 text-center border-b border-slate-200">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-base">
              {sortedPositions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                        <div className="p-4 bg-slate-50 rounded-full">
                            <Plus className="w-6 h-6 text-slate-300" />
                        </div>
                        <p>暂无持仓，点击右上角"记一笔"</p>
                    </div>
                  </td>
                </tr>
              ) : sortedPositions.map((pos) => {
                // ML 估算处理：当 is_est_valid=false 但有 estimate 时，手动计算 day_income
                const displayDayIncome = pos.is_est_valid
                  ? pos.day_income
                  : (pos.estimate > 0 ? (pos.estimate - pos.nav) * pos.shares : 0);

                // 判断是否有有效估值（用于显示颜色）
                const hasValidEstimate = pos.estimate > 0;

                return (
                  <tr key={pos.code} className="hover:bg-slate-50/80 transition-colors group/row">
                    {/* Fund Info Column */}
                    <td
                      className="px-5 py-4 cursor-pointer group max-w-[240px]"
                      onClick={() => onSelectFund && onSelectFund(pos.code)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate text-[15px]" title={pos.name}>
                            {pos.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                             <div className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{pos.code}</div>
                          </div>
                        </div>
                        <div className={`text-sm font-bold whitespace-nowrap px-2 py-0.5 rounded-lg ${
                            pos.accumulated_return_rate > 0 
                                ? 'bg-red-50 text-rose-600' 
                                : pos.accumulated_return_rate < 0 
                                    ? 'bg-emerald-50 text-emerald-600' 
                                    : 'bg-slate-100 text-slate-500'
                        }`}>
                          {pos.accumulated_return_rate > 0 ? '+' : ''}{pos.accumulated_return_rate.toFixed(2)}%
                        </div>
                      </div>
                    </td>

                    {/* Estimate / NAV Column */}
                    <td className="px-5 py-4 text-right font-mono">
                      <div className="flex items-center justify-end gap-1">
                        <div
                          className={`font-bold text-[15px] ${!hasValidEstimate ? 'text-slate-400' : getRateColor(pos.est_rate)}`}
                          title={!pos.is_est_valid && hasValidEstimate ? "ML估算" : "实时估值"}
                        >
                          {hasValidEstimate ? pos.estimate.toFixed(4) + (!pos.is_est_valid ? '*' : '') : '--'}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <div className="text-slate-400 text-xs" title="昨日净值">{pos.nav.toFixed(4)}</div>
                        {pos.nav_updated_today ? (
                          <CheckCircle className="w-3 h-3 text-emerald-500" title="当日净值已更新" />
                        ) : (
                          <Clock className="w-3 h-3 text-slate-400" title="当日净值未更新" />
                        )}
                      </div>
                    </td>

                    {/* Intraday PnL Column */}
                    <td className="px-5 py-4 text-right font-mono">
                      <div className={`font-bold text-[15px] ${!hasValidEstimate ? 'text-slate-400' : getRateColor(displayDayIncome)}`}>
                        {hasValidEstimate ? (displayDayIncome > 0 ? '+' : '') + displayDayIncome.toFixed(2) + (!pos.is_est_valid ? '*' : '') : '--'}
                      </div>
                      <div className={`text-xs mt-0.5 font-medium ${!hasValidEstimate ? 'text-slate-400' : getRateColor(pos.est_rate)}`}>
                        {hasValidEstimate ? (pos.est_rate > 0 ? '+' : '') + pos.est_rate.toFixed(2) + '%' + (!pos.is_est_valid ? '*' : '') : '--'}
                      </div>
                    </td>

                    {/* Holding Value / Income (Yesterday) */}
                    <td className="px-5 py-4 text-right font-mono">
                      <div className="text-slate-900 font-bold text-[15px]">
                        {pos.nav_market_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <div className={`text-xs mt-0.5 font-medium ${getRateColor(pos.accumulated_income)}`}>
                        {pos.accumulated_income > 0 ? '+' : ''}{pos.accumulated_income.toFixed(2)}
                      </div>
                    </td>

                    {/* Shares / Cost Column */}
                    <td className="px-5 py-4 text-right font-mono text-slate-500">
                      <div className="text-sm font-medium">{pos.shares.toLocaleString()}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{pos.cost.toFixed(4)}</div>
                    </td>

                    {/* Total Projected PnL Column */}
                    <td className="px-5 py-4 text-right font-mono">
                      <div className={`font-bold text-[15px] ${getRateColor(pos.total_income)}`}>
                        {pos.total_income > 0 ? '+' : ''}{pos.total_income.toFixed(2)}
                      </div>
                      <div className={`text-xs mt-0.5 font-medium ${getRateColor(pos.total_return_rate)}`}>
                        {pos.total_return_rate > 0 ? '+' : ''}{pos.total_return_rate.toFixed(2)}%
                      </div>
                    </td>

                    {/* Actions Column */}
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        {!isAggregatedView && (
                          <>
                            <button
                              onClick={() => handleOpenModal(pos)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="修改持仓"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePosition(pos.code)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {isAggregatedView && (
                          <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">仅查看</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <PositionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitPosition}
        editingPos={editingPos}
        submitting={submitting}
        onOpenAdd={setAddModalPos}
        onOpenReduce={setReduceModalPos}
        currentAccount={currentAccount}
      />

      <AddPositionModal
        isOpen={!!addModalPos}
        onClose={() => setAddModalPos(null)}
        onSubmit={handleAddPosition}
        position={addModalPos}
        submitting={submitting}
      />

      <ReducePositionModal
        isOpen={!!reduceModalPos}
        onClose={() => setReduceModalPos(null)}
        onSubmit={handleReducePosition}
        position={reduceModalPos}
        submitting={submitting}
      />
    </div>
  );
};

export default Account;