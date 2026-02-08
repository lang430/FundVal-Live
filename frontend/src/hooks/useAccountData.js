import { useState, useEffect, useCallback } from 'react';
import { getAccountPositions } from '../services/api';

/**
 * 账户数据管理 Hook
 * 负责数据获取、轮询、重试、错误处理
 *
 * @param {number} currentAccount - 当前账户 ID
 * @param {boolean} isActive - 是否激活轮询
 * @returns {Object} { data, loading, error, refetch }
 */
export function useAccountData(currentAccount, isActive = true) {
  const [data, setData] = useState({ summary: {}, positions: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * 获取数据（带重试逻辑）
   */
  const fetchData = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setError(null);

    try {
      const res = await getAccountPositions(currentAccount);
      setData(res);
    } catch (e) {
      console.error(e);

      // 重试逻辑：最多重试 2 次，指数退避
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
        console.log(`Retrying in ${delay}ms... (attempt ${retryCount + 1}/2)`);
        setTimeout(() => fetchData(retryCount + 1), delay);
      } else {
        setError('加载账户数据失败，请检查后端服务是否启动');
      }
    } finally {
      setLoading(false);
    }
  }, [currentAccount]);

  /**
   * 静默刷新（轮询时使用，不显示 loading）
   */
  const silentRefresh = useCallback(async () => {
    try {
      const res = await getAccountPositions(currentAccount);
      setData(res);
    } catch (e) {
      console.error('Silent refresh failed:', e);
    }
  }, [currentAccount]);

  // 账户切换时重新加载数据
  useEffect(() => {
    fetchData();
  }, [currentAccount, fetchData]);

  // 轮询机制：每 15 秒自动刷新数据
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      silentRefresh();
    }, 15000);

    return () => clearInterval(interval);
  }, [isActive, silentRefresh]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}
