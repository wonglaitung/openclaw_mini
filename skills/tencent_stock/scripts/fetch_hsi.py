#!/usr/bin/env python3
"""
Hang Seng Index Data Fetcher using Tencent Finance API

Fetches HSI (Hang Seng Index) historical data from Tencent Finance API.
Returns structured JSON/CSV data with HSI information.

Usage:
    python3 fetch_hsi.py [period_days]
    python3 fetch_hsi.py 90
    python3 fetch_hsi.py 30
"""

import sys
import json
import requests
from datetime import datetime

def fetch_hsi_data_tencent(period_days=90):
    """
    Fetch HSI data from Tencent Finance API.

    Args:
        period_days (int): Number of days to fetch, default 90

    Returns:
        list: List of dictionaries containing HSI data
    """
    try:
        # Tencent Finance API URL for HSI historical data
        # First try to get forward-adjusted data
        url = f"https://web.ifzq.gtimg.cn/appstock/app/hkfqkline/get?param=hkHSI,day,,,{period_days},qfq"

        # Make request
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        # Parse returned JSON data
        data = response.json()

        # Check if data is valid
        if 'data' not in data or 'hkHSI' not in data['data']:
            raise ValueError("Unable to get HSI data")

        # Extract K-line data
        kline_data = None
        if 'qfqday' in data['data']['hkHSI']:
            kline_data = data['data']['hkHSI']['qfqday']
        elif 'day' in data['data']['hkHSI']:
            kline_data = data['data']['hkHSI']['day']

        # If forward-adjusted data is empty, try to get original data
        if not kline_data or len(kline_data) == 0:
            url = f"https://web.ifzq.gtimg.cn/appstock/app/hkfqkline/get?param=hkHSI,day,,,{period_days}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()

            # Check if data is valid
            if 'data' not in data or 'hkHSI' not in data['data']:
                raise ValueError("Unable to get HSI data")

            # Extract K-line data
            if 'day' in data['data']['hkHSI']:
                kline_data = data['data']['hkHSI']['day']

        if kline_data is None or len(kline_data) == 0:
            raise ValueError("Unable to get HSI K-line data")

        # Parse data
        # Data format: ["2023-10-26", "320.00", "325.00", "318.00", "322.00", "1000000", {}]
        # Date, open, close, high, low, volume, other data
        parsed_data = []
        for item in kline_data:
            if len(item) >= 6:
                parsed_data.append({
                    'Date': item[0],
                    'Open': float(item[1]),
                    'Close': float(item[2]),
                    'High': float(item[3]),
                    'Low': float(item[4]),
                    'Volume': int(float(item[5]))
                })

        # Take the last period_days of data
        parsed_data = parsed_data[-period_days:] if len(parsed_data) > period_days else parsed_data

        return parsed_data

    except requests.exceptions.RequestException as e:
        return {"error": f"Network error: {str(e)}"}
    except ValueError as e:
        return {"error": f"Data parsing error: {str(e)}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}

def format_output(hsi_data):
    """Format HSI data for display."""
    if 'error' in hsi_data:
        return f"❌ Error: {hsi_data['error']}"

    if not hsi_data or len(hsi_data) == 0:
        return "❌ No data available"

    output = []
    output.append(f"📊 Hang Seng Index (HSI) - Historical Data")
    output.append(f"📅 Total records: {len(hsi_data)}")
    output.append("")

    # Calculate basic statistics
    if len(hsi_data) > 0:
        latest = hsi_data[-1]
        output.append(f"📈 Latest ({latest['Date']}):")
        output.append(f"   Close: {latest['Close']:.2f}")
        output.append(f"   Change: {latest['Close'] - latest['Open']:+.2f}")
        output.append(f"   High: {latest['High']:.2f}")
        output.append(f"   Low: {latest['Low']:.2f}")
        output.append(f"   Volume: {latest['Volume']:,}")
        output.append("")

    output.append("Date        Open      Close     High      Low       Volume")
    output.append("-" * 70)

    # Display last 10 records
    recent_data = hsi_data[-10:] if len(hsi_data) > 10 else hsi_data
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
    """Main function to fetch and display HSI data."""
    period_days = int(sys.argv[1]) if len(sys.argv) > 1 else 90

    print(f"🔍 Fetching HSI data (last {period_days} days)")
    print()

    # Fetch data from Tencent Finance
    hsi_data = fetch_hsi_data_tencent(period_days)

    # Output JSON
    print("📋 JSON Data (first 5 records):")
    if isinstance(hsi_data, list):
        print(json.dumps(hsi_data[:5], indent=2, ensure_ascii=False))
        if len(hsi_data) > 5:
            print(f"... ({len(hsi_data) - 5} more records)")
    else:
        print(json.dumps(hsi_data, indent=2, ensure_ascii=False))
    print()

    # Output formatted display
    print("📈 Formatted Output:")
    print(format_output(hsi_data))

if __name__ == "__main__":
    main()