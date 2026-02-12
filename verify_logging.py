
import sys
import os
import logging

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Configure logging to stdout
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

from app.services.fund import get_eastmoney_valuation, get_sina_valuation, get_eastmoney_pingzhong_data, _fetch_stock_spots_sina

def verify_logging():
    code = "005827" # E Fund Blue Chip Mixed
    print(f"Testing logging for fund {code}...")

    print("\n--- Testing Eastmoney Valuation ---")
    get_eastmoney_valuation(code)

    print("\n--- Testing Sina Valuation ---")
    get_sina_valuation(code)

    print("\n--- Testing PingZhong Data ---")
    get_eastmoney_pingzhong_data(code)
    
    # Test stock spots (e.g. Moutai)
    print("\n--- Testing Sina Stock Spots ---")
    _fetch_stock_spots_sina(["600519"])

if __name__ == "__main__":
    verify_logging()
