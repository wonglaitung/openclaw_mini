---
name: tencent_stock
description: 查询香港股票价格和交易数据。使用腾讯财经接口获取实时股票数据和历史K线数据，包括股票名称、最新价格、涨跌幅、成交量、历史走势等关键信息。适用于需要查询港股实时行情、跟踪股票价格变动、分析历史趋势的场景。
---

# Tencent Stock

## Overview

查询香港股票价格和交易数据，从腾讯财经接口获取实时股票数据和历史K线数据。

## Quick Start

### 查询股票基本信息

使用股票代码查询股票实时行情：

```bash
cd {baseDir}/scripts
python3 fetch_stock.py 01398
```

示例：

- 工商银行 (01398): `python3 fetch_stock.py 01398`
- 腾讯控股 (00700): `python3 fetch_stock.py 0700`
- 长和 (00001): `python3 fetch_stock.py 00001`

### 查询股票历史K线数据

获取指定天数的历史K线数据：

```bash
cd {baseDir}/scripts
python3 fetch_kline.py 01398 90
```

### 查询恒生指数

获取恒生指数数据：

```bash
cd {baseDir}/scripts
python3 fetch_hsi.py
```

## Core Capabilities

### 1. 获取股票实时价格

从腾讯财经接口获取以下信息：

- 股票代码
- 股票名称
- 当前价格
- 涨跌额
- 涨跌幅
- 昨收价

### 2. 获取股票历史K线数据

获取指定天数的历史K线数据，包括：

- 日期
- 开盘价
- 收盘价
- 最高价
- 最低价
- 成交量

### 3. 获取恒生指数数据

获取恒生指数的历史走势数据

### 4. 批量查询

可以一次查询多只股票，便于对比和跟踪。

## Usage

### 使用 Python 脚本进行数据提取

**查询实时股票信息**:

```bash
cd {baseDir}/scripts
python3 fetch_stock.py 01398
```

**查询历史K线数据**:

```bash
cd {baseDir}/scripts
python3 fetch_kline.py 01398 90
```

**查询恒生指数**:

```bash
cd {baseDir}/scripts
python3 fetch_hsi.py
```

脚本会返回结构化的 JSON 数据，包含所有关键信息。

## Stock Code Format

香港股票代码格式：

- 5 位数字，如 `01398`（工商银行）
- 4 位数字也会自动补零，如 `700` → `00700`（腾讯）

## Data Fields

### 实时股票信息

- `stock_code`: 股票代码
- `stock_name`: 股票名称
- `current_price`: 当前价格
- `prev_close`: 昨收价
- `change_amount`: 涨跌额
- `change_percent`: 涨跌幅 (%)

### 历史K线数据

- `Date`: 日期
- `Open`: 开盘价
- `High`: 最高价
- `Low`: 最低价
- `Close`: 收盘价
- `Volume`: 成交量

## Examples

### 查询单只股票

**用户请求**: "查询工商银行 01398 的当前价格"

**执行步骤**:

1. 使用脚本调用: `python3 fetch_stock.py 01398`
2. 脚本调用腾讯财经接口获取数据
3. 返回格式化的结果

**示例输出**:

```
工商银行 (01398)
当前价格: 4.25 HKD
涨跌: +0.05 (+1.19%)
昨收价: 4.20 HKD
```

### 查询股票历史数据

**用户请求**: "查询腾讯控股 00700 最近90天的K线数据"

**执行步骤**:

1. 使用脚本调用: `python3 fetch_kline.py 00700 90`
2. 脚本调用腾讯财经接口获取历史K线数据
3. 返回历史数据的DataFrame或JSON

### 查询多只股票

**用户请求**: "查询 00700、01398、00001 这三只股票的价格"

**执行步骤**:

1. 依次查询每只股票
2. 整理为对比表格
3. 返回汇总结果

## Notes

- 腾讯财经数据可能有延迟，不是实时交易数据
- 某些字段可能在特定时间不可用（如休市期间）
- API 可能有访问频率限制，请合理使用
- 股票代码需要为有效的香港股票代码
- 历史K线数据最多支持获取最近几年的数据

## Troubleshooting

### 无法获取数据

- 检查股票代码是否正确
- 检查网络连接
- 检查是否能够访问腾讯财经接口

### API 错误

- 检查 API 响应中的错误信息
- 确认股票代码格式正确（应为 4-5 位数字）
- 检查是否需要更新 User-Agent 或 Referer

### 数据格式错误

- 检查返回的数据格式是否符合预期
- 查看控制台输出的调试信息

## Resources

### scripts/

- `fetch_stock.py`: Python 脚本，用于提取股票实时信息
  - 输入: 股票代码
  - 输出: JSON 格式的股票实时信息

- `fetch_kline.py`: Python 脚本，用于提取股票历史K线数据
  - 输入: 股票代码、天数
  - 输出: DataFrame 或 JSON 格式的K线数据

- `fetch_hsi.py`: Python 脚本，用于提取恒生指数数据
  - 输入: 天数（可选，默认90天）
  - 输出: DataFrame 或 JSON 格式的指数数据

使用方法:

```bash
# 查询实时信息
python3 fetch_stock.py 01398

# 查询历史K线
python3 fetch_kline.py 01398 90

# 查询恒生指数
python3 fetch_hsi.py
```
