import logging
from datetime import datetime
from ..db import get_db_connection

logger = logging.getLogger(__name__)

def add_subscription(code: str, email: str, up: float, down: float, enable_digest: bool = False, digest_time: str = "14:45", enable_volatility: bool = True):
    """
    Save or update a subscription for a fund/email pair.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # We allow one subscription per fund+email combination
    cursor.execute("""
        INSERT OR REPLACE INTO subscriptions 
        (code, email, threshold_up, threshold_down, enable_digest, digest_time, enable_volatility)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (code, email, up, down, int(enable_digest), digest_time, int(enable_volatility)))
    
    conn.commit()
    conn.close()
    logger.info(f"Subscription updated: {email} -> {code} (Volatility: {enable_volatility}, Digest: {enable_digest} @ {digest_time})")

def get_active_subscriptions():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM subscriptions")
    rows = cursor.fetchall()
    conn.close()
    return rows

def update_notification_time(sub_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE subscriptions SET last_notified_at = CURRENT_TIMESTAMP WHERE id = ?", (sub_id,))
    conn.commit()
    conn.close()

def update_digest_time(sub_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE subscriptions SET last_digest_at = CURRENT_TIMESTAMP WHERE id = ?", (sub_id,))
    conn.commit()
    conn.close()
