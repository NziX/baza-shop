import os
import sqlite3
import json
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), "baza_shop.db")

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create products table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        compare_at_price REAL,
        stock INTEGER NOT NULL DEFAULT 10,
        image_url TEXT NOT NULL,
        description TEXT,
        specs TEXT,
        is_featured INTEGER DEFAULT 0,
        is_trending INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Create orders table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_code TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        notes TEXT,
        payment_method TEXT NOT NULL DEFAULT 'momo',
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        shipping_fee REAL DEFAULT 0,
        total REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        coupon_code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Create order items table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        product_image TEXT,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    """)

    # Create coupons table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_percent REAL NOT NULL,
        min_order_amount REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1
    );
    """)

    # Create settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)

    # Create customer reviews table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        customer_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    """)

    conn.commit()

    # Ensure baseline store configuration exists without touching or adding any products/orders/reviews
    init_default_settings(cursor)
    conn.commit()

    conn.close()

def init_default_settings(cursor):
    """
    Sets default store settings only if not already present.
    NEVER seeds dummy products, demo orders, fake reviews, or dummy coupons.
    """
    default_settings = [
        ("store_name", "Baza Shop"),
        ("store_tagline", "Curated Modern Lighting & Premium Home Aesthetics"),
        ("instagram_handle", "baza_shop2"),
        ("instagram_url", "https://www.instagram.com/baza_shop2"),
        ("whatsapp_number", ""),
        ("currency_symbol", "RWF"),
        ("delivery_fee", "3000"),
        ("free_shipping_threshold", "75000"),
        ("announcement_text", "✨ Welcome to Baza Shop! Explore modern lighting & premium decor."),
        ("admin_pin", "123456"),
        ("recovery_key", "BAZA-RESET-2026")
    ]
    cursor.executemany("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", default_settings)

if __name__ == "__main__":
    init_db()
    print("Database schema verified and ready for Baza Shop.")
