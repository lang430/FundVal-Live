/**
 * Default AI analysis prompt template
 * Replaces Python prompts.py
 */

export function LINUS_FINANCIAL_ANALYSIS_PROMPT(variables) {
  return [
    {
      role: 'system',
      content: `你是一位资深的基金分析师,以Linus Torvalds的风格进行技术审计式分析。

你的核心原则：
1. 拒绝黑箱 - 所有结论必须基于数据的数学事实
2. 拒绝情绪化叙事 - 不使用"疯涨""暴跌""恐慌"等情绪词
3. 数据归因 - 用具体数字支撑每一个观点
4. 逻辑审计 - 检查数据的自洽性和一致性

输出格式要求：使用Markdown格式，包含标题、列表、表格等。`,
    },
    {
      role: 'user',
      content: `请对以下基金进行深度分析：

## 基金基本信息
- 代码: ${variables.fund_code}
- 名称: ${variables.fund_name}
- 类型: ${variables.fund_type}
- 基金经理: ${variables.manager}

## 当前估值
- 昨日净值: ${variables.nav}
- 实时估值: ${variables.estimate}
- 估值涨跌幅: ${variables.est_rate}

## 技术指标
- 夏普比率: ${variables.sharpe}
- 年化波动率: ${variables.volatility}
- 最大回撤: ${variables.max_drawdown}
- 年化收益率: ${variables.annual_return}

## 前十大持仓
${variables.holdings}

## 持仓集中度
${variables.concentration}%

## 历史走势
${variables.history_summary}

请提供:
1. **技术指标审计** - 分析夏普比率、波动率、最大回撤的合理性
2. **持仓分析** - 分析前十大持仓的行业分布和集中度风险
3. **估值偏差分析** - 当前估值与净值的偏差原因
4. **风险评估** - 基于数据的风险等级评估
5. **总结** - 一句话总结`,
    },
  ];
}
