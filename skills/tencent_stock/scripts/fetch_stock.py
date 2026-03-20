#!/usr/bin/env python3
"""
Hong Kong Stock Real-time Data Fetcher using Tencent Finance API

Fetches real-time stock data from Tencent Finance API.
Returns structured JSON data with stock information.

Usage:
    python3 fetch_stock.py <stock_code>
    python3 fetch_stock.py 1288
    python3 fetch_stock.py 0700
"""

import sys
import json
import requests
from datetime import datetime

def clean_stock_code(stock_code):
    """
    Clean and normalize stock code for Tencent Finance.

    Hong Kong stocks use 5-digit format in Tencent Finance.

    Examples:
        1288 -> 01288
        01288 -> 01288
        1288 -> 01288
        700 -> 00700
        0700 -> 00700
    """
    # Remove spaces and convert to string
    code = str(stock_code).strip()
    # Pad with leading zeros to make it 5 digits
    return code.zfill(5)

def fetch_stock_info_tencent(stock_code):
    """
    Fetch real-time stock data from Tencent Finance API.

    Uses Tencent Finance's public API endpoint for real-time data.
    """
    try:
        # Tencent Finance API URL for real-time data
        formatted_code = clean_stock_code(stock_code)
        url = f"http://qt.gtimg.cn/q=hk{formatted_code}"

        # Add headers to mimic browser request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Referer': 'https://stockapp.finance.qq.com/'
        }

        # Make request
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        # Parse response data
        data = response.text
        if not data.startswith('v_'):
            raise ValueError(f"Invalid response format: {data[:50]}")

        # Extract data parts
        data_parts = data.split('~')
        if len(data_parts) <= 3:
            raise ValueError("Insufficient data in response")

        # Parse stock information
        stock_name = data_parts[1]
        current_price = float(data_parts[3]) if data_parts[3] else None
        prev_close = float(data_parts[4]) if data_parts[4] else None
        change_amount = float(data_parts[31]) if data_parts[31] else None
        change_percent = float(data_parts[32]) if data_parts[32] else None

        # Build stock data dictionary
        stock_data = {
            "stock_code": formatted_code,
            "stock_name": stock_name,
            "current_price": current_price,
            "prev_close": prev_close,
            "change_amount": change_amount,
            "change_percent": change_percent,
            "timestamp": datetime.now().isoformat()
        }

        return stock_data

    except requests.exceptions.RequestException as e:
        return {"error": f"Network error: {str(e)}"}
    except ValueError as e:
        return {"error": f"Data parsing error: {str(e)}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}

def format_output(stock_data):
    """Format stock data for display."""
    if 'error' in stock_data:
        return f"❌ Error: {stock_data['error']}"

    output = []
    output.append(f"📊 {stock_data['stock_name']} ({stock_data['stock_code']})")

    if stock_data['current_price'] is not None:
        output.append(f"💰 当前价格: {stock_data['current_price']:.2f} HKD")
    else:
        output.append(f"💰 当前价格: N/A")

    if stock_data['change_amount'] is not None and stock_data['change_percent'] is not None:
        if stock_data['change_amount'] >= 0:
            output.append(f"📈 涨跌: +{stock_data['change_amount']:.2f} (+{stock_data['change_percent']:.2f}%)")
        else:
            output.append(f"📉 涨跌: {stock_data['change_amount']:.2f} ({stock_data['change_percent']:.2f}%)")
    else:
        output.append(f"📈 涨跌: N/A")

    if stock_data['prev_close'] is not None:
        output.append(f"📅 昨收价: {stock_data['prev_close']:.2f} HKD")
    else:
        output.append(f"📅 昨收价: N/A")

    output.append(f"🕐 时间: {stock_data['timestamp']}")

    return '\n'.join(output)

def main():
    """Main function to fetch and display stock data."""
    if len(sys.argv) < 2:
        print("Usage: python3 fetch_stock.py <stock_code>")
        print("Example: python3 fetch_stock.py 1288")
        print("         python3 fetch_stock.py 0700")
        sys.exit(1)

    stock_code = sys.argv[1]

    print(f"🔍 Fetching stock data for: {stock_code}")
    print()

    # Fetch data from Tencent Finance
    stock_data = fetch_stock_info_tencent(stock_code)

    # Output JSON
    print("📋 JSON Data:")
    print(json.dumps(stock_data, indent=2, ensure_ascii=False))
    print()

    # Output formatted display
    print("📈 Formatted Output:")
    print(format_output(stock_data))

if __name__ == "__main__":
    main()