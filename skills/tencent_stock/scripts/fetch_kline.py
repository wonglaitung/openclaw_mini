#!/usr/bin/env python3
"""
Hong Kong Stock Historical K-Line Data Fetcher using Tencent Finance API

Fetches historical K-line data from Tencent Finance API.
Returns structured JSON/CSV data with historical stock information.

Usage:
    python3 fetch_kline.py <stock_code> [period_days]
    python3 fetch_kline.py 1288 90
    python3 fetch_kline.py 0700 30
"""

import sys
import json
import requests
from datetime import datetime

def clean_stock_code(stock_code):
    """
    Clean and normalize stock code for Tencent Finance.

    Hong Kong stocks use 5-digit format in Tencent Finance.
    """
    code = str(stock_code).strip()
    return code.zfill(5)

def fetch_hk_stock_kline_tencent(stock_code, period_days=90):
    """
    Fetch historical K-line data from Tencent Finance API.

    Args:
        stock_code (str): Stock code, e.g., "00700" (Tencent)
        period_days (int): Number of days to fetch, default 90

    Returns:
        list: List of dictionaries containing K-line data
    """
    try:
        # Format stock code to 5 digits
        formatted_code = clean_stock_code(stock_code)

        # Tencent Finance API URL for historical K-line data
        url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?_var=kline_dayqfq&param=hk{formatted_code},day,,,{period_days},qfq&r=0.123456"

        # Add headers to mimic browser request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Referer': 'https://stockapp.finance.qq.com/'
        }

        # Make request
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        # Parse returned JSON data (need to remove callback function name)
        text_data = response.text
        if text_data.startswith("kline_dayqfq="):
            # Extract the part after the equals sign
            json_str = text_data[13:]  # Remove "kline_dayqfq="
            data = json.loads(json_str)
        else:
            raise ValueError(f"Unable to parse return data: {text_data[:50]}")

        # Check if data is valid
        if 'data' not in data or f'hk{formatted_code}' not in data['data']:
            raise ValueError(f"Unable to get data for stock {stock_code}")

        # Extract K-line data
        kline_data = None
        if 'day' in data['data'][f'hk{formatted_code}']:
            kline_data = data['data'][f'hk{formatted_code}']['day']

        if kline_data is None or len(kline_data) == 0:
            raise ValueError(f"Unable to get K-line data for stock {stock_code}")

        # Parse data
        # Data format: [date, open, close, low, high, volume, other info]
        parsed_data = []
        for item in kline_data:
            if len(item) >= 6:
                parsed_data.append({
                    'Date': item[0],
                    'Open': float(item[1]),
                    'Close': float(item[2]),
                    'Low': float(item[3]),
                    'High': float(item[4]),
                    'Volume': int(float(item[5]))
                })

        return parsed_data

    except requests.exceptions.RequestException as e:
        return {"error": f"Network error: {str(e)}"}
    except ValueError as e:
        return {"error": f"Data parsing error: {str(e)}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}

def format_output(kline_data, stock_code):
    """Format K-line data for display."""
    if 'error' in kline_data:
        return f"❌ Error: {kline_data['error']}"

    if not kline_data or len(kline_data) == 0:
        return "❌ No data available"

    output = []
    output.append(f"📊 {stock_code} - Historical K-Line Data")
    output.append(f"📅 Total records: {len(kline_data)}")
    output.append("")
    output.append("Date        Open      Close     High      Low       Volume")
    output.append("-" * 70)

    # Display last 10 records
    recent_data = kline_data[-10:] if len(kline_data) > 10 else kline_data
    for item in recent_data:
        output.append(
            f"{item['Date']:11} "
            f"{item['Open']:8.2f} "
            f"{item['Close']:8.2f} "
            f"{item['High']:8.2f} "
            f"{item['Low']:8.2f} "
            f"{item['Volume']:10,}"
        )

    return '\n'.join(output)

def main():
    """Main function to fetch and display K-line data."""
    if len(sys.argv) < 2:
        print("Usage: python3 fetch_kline.py <stock_code> [period_days]")
        print("Example: python3 fetch_kline.py 1288 90")
        print("         python3 fetch_kline.py 0700 30")
        sys.exit(1)

    stock_code = sys.argv[1]
    period_days = int(sys.argv[2]) if len(sys.argv) > 2 else 90

    print(f"🔍 Fetching K-line data for: {stock_code} (last {period_days} days)")
    print()

    # Fetch data from Tencent Finance
    kline_data = fetch_hk_stock_kline_tencent(stock_code, period_days)

    # Output JSON
    print("📋 JSON Data (first 5 records):")
    if isinstance(kline_data, list):
        print(json.dumps(kline_data[:5], indent=2, ensure_ascii=False))
        if len(kline_data) > 5:
            print(f"... ({len(kline_data) - 5} more records)")
    else:
        print(json.dumps(kline_data, indent=2, ensure_ascii=False))
    print()

    # Output formatted display
    print("📈 Formatted Output:")
    print(format_output(kline_data, stock_code))

if __name__ == "__main__":
    main()