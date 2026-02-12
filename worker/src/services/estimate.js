/**
 * Estimation algorithms (pure JS, replaces numpy-based estimate.py)
 */

/**
 * Weighted moving average estimation
 */
export function estimateWithWeightedMa(history, weights = null) {
  if (!history || history.length < 2) return null;

  weights = weights || [0.4, 0.3, 0.2, 0.07, 0.03];
  const n = Math.min(weights.length, history.length - 1);
  if (n < 2) return null;

  try {
    const changes = [];
    for (let i = 1; i <= n; i++) {
      const currentNav = parseFloat(history[history.length - i].nav);
      const prevNav = parseFloat(history[history.length - i - 1].nav);
      changes.push((currentNav - prevNav) / prevNav * 100);
    }

    const weightedSum = changes.reduce((sum, c, i) => sum + c * weights[i], 0);
    const weightTotal = weights.slice(0, n).reduce((a, b) => a + b, 0);
    const weightedChange = weightedSum / weightTotal;

    const yesterdayNav = parseFloat(history[history.length - 1].nav);
    const estimatedNav = yesterdayNav * (1 + weightedChange / 100);

    let confidence = Math.min(n / weights.length, 1.0);
    const avgVolatility = changes.reduce((s, c) => s + Math.abs(c), 0) / n;
    if (avgVolatility > 3.0) confidence *= 0.8;

    return {
      estimate: Math.round(estimatedNav * 10000) / 10000,
      est_rate: Math.round(weightedChange * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      method: 'weighted_ma',
    };
  } catch {
    return null;
  }
}

/**
 * Simple moving average estimation (fallback)
 */
export function estimateWithSimpleMa(history, days = 5) {
  if (!history || history.length < 2) return null;
  const n = Math.min(days, history.length - 1);

  try {
    const changes = [];
    for (let i = 1; i <= n; i++) {
      const currentNav = parseFloat(history[history.length - i].nav);
      const prevNav = parseFloat(history[history.length - i - 1].nav);
      changes.push((currentNav - prevNav) / prevNav * 100);
    }

    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const yesterdayNav = parseFloat(history[history.length - 1].nav);
    const estimatedNav = yesterdayNav * (1 + avgChange / 100);

    return {
      estimate: Math.round(estimatedNav * 10000) / 10000,
      est_rate: Math.round(avgChange * 100) / 100,
      confidence: 0.6,
      method: 'simple_ma',
    };
  } catch {
    return null;
  }
}

/**
 * Smart estimation entry point
 */
export function estimateNav(code, history) {
  if (!history || history.length < 2) return null;

  if (history.length >= 5) {
    const result = estimateWithWeightedMa(history);
    if (result) return result;
  }

  return estimateWithSimpleMa(history);
}
