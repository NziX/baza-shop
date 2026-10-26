import os
import random
import string
import json
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, render_template, session
from database import init_db, get_db_connection

app = Flask(__name__)
app.secret_key = os.urandom(24)

# File upload configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "static", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize database schema and initial data
init_db()

# Ensure master recovery key exists in settings
_init_conn = get_db_connection()
_init_conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('recovery_key', 'BAZA-RESET-2026')")
_init_conn.commit()
_init_conn.close()

def get_setting(key, default=""):
    conn = get_db_connection()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default

def format_currency(amount):
    sym = get_setting("currency_symbol", "RWF")
    try:
        val = float(amount)
        if sym.upper() in ["RWF", "FRW", "RWANDA"]:
            formatted = f"{int(round(val)):,}"
        else:
            formatted = f"{val:,.2f}"
    except (ValueError, TypeError):
        formatted = str(amount)
    return f"{sym}{formatted}" if len(sym) <= 2 else f"{formatted} {sym}"

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify({"error": "Unauthorized. Please log in as store admin."}), 401
        return f(*args, **kwargs)
    return decorated_function

# ----------------- PAGE ROUTES ----------------- #

@app.route("/health")
def health():
    return jsonify({"status": "ok", "app": "Baza Shop"}), 200

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/admin")
def admin_page():
    return render_template("admin.html")

# ----------------- PUBLIC API ----------------- #

@app.route("/api/store-info", methods=["GET"])
def store_info():
    conn = get_db_connection()
    settings_rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    
    settings_dict = {row["key"]: row["value"] for row in settings_rows}
    # Hide admin pin and recovery key from public response
    settings_dict.pop("admin_pin", None)
    settings_dict.pop("recovery_key", None)
    return jsonify(settings_dict)

@app.route("/api/categories", methods=["GET"])
def get_categories():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT category, COUNT(*) as count 
        FROM products 
        WHERE status = 'active' 
        GROUP BY category
    """).fetchall()
    conn.close()
    return jsonify([{"name": r["category"], "count": r["count"]} for r in rows])

@app.route("/api/products", methods=["GET"])
def get_products():
    category = request.args.get("category", "")
    search = request.args.get("search", "").strip()
    featured = request.args.get("featured", "")
    sort_by = request.args.get("sort", "featured")
    
    conn = get_db_connection()
    query = "SELECT * FROM products WHERE status = 'active'"
    params = []

    if category and category != "All":
        query += " AND category = ?"
        params.append(category)

    if featured == "1":
        query += " AND is_featured = 1"

    if search:
        query += " AND (name LIKE ? OR description LIKE ? OR category LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard])

    if sort_by == "price_asc":
        query += " ORDER BY price ASC"
    elif sort_by == "price_desc":
        query += " ORDER BY price DESC"
    elif sort_by == "newest":
        query += " ORDER BY created_at DESC"
    else:
        query += " ORDER BY is_featured DESC, is_trending DESC, id DESC"

    rows = conn.execute(query, params).fetchall()
    
    products = []
    for r in rows:
        p = dict(r)
        if p.get("specs"):
            try:
                p["specs"] = json.loads(p["specs"])
            except:
                pass
        products.append(p)

    conn.close()
    return jsonify(products)

@app.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Product not found"}), 404

    product = dict(row)
    if product.get("specs"):
        try:
            product["specs"] = json.loads(product["specs"])
        except:
            pass

    reviews = conn.execute("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC", (product_id,)).fetchall()
    product["reviews"] = [dict(rev) for rev in reviews]

    # Calculate average rating
    if product["reviews"]:
        product["rating_avg"] = round(sum(r["rating"] for r in product["reviews"]) / len(product["reviews"]), 1)
        product["rating_count"] = len(product["reviews"])
    else:
        product["rating_avg"] = 5.0
        product["rating_count"] = 0

    conn.close()
    return jsonify(product)

@app.route("/api/products/<int:product_id>/reviews", methods=["POST"])
def add_review(product_id):
    data = request.json or {}
    customer_name = data.get("customer_name", "").strip() or "Verified Buyer"
    rating = int(data.get("rating", 5))
    comment = data.get("comment", "").strip()

    if not comment:
        return jsonify({"error": "Please provide a review comment"}), 400

    conn = get_db_connection()
    conn.execute("""
        INSERT INTO reviews (product_id, customer_name, rating, comment)
        VALUES (?, ?, ?, ?)
    """, (product_id, customer_name, max(1, min(5, rating)), comment))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Thank you! Your review has been published."})

@app.route("/api/coupon/validate", methods=["POST"])
def validate_coupon():
    data = request.json or {}
    code = data.get("code", "").strip().upper()
    subtotal = float(data.get("subtotal", 0))

    conn = get_db_connection()
    coupon = conn.execute("SELECT * FROM coupons WHERE UPPER(code) = ? AND is_active = 1", (code,)).fetchone()
    conn.close()

    if not coupon:
        return jsonify({"valid": False, "message": "Invalid or expired coupon code."}), 400

    min_amount = float(coupon["min_order_amount"])
    if subtotal < min_amount:
        return jsonify({
            "valid": False,
            "message": f"This code requires a minimum order of {format_currency(min_amount)}."
        }), 400

    discount_percent = float(coupon["discount_percent"])
    discount_amount = round(subtotal * (discount_percent / 100.0), 2)

    return jsonify({
        "valid": True,
        "code": coupon["code"],
        "discount_percent": discount_percent,
        "discount_amount": discount_amount,
        "message": f"Promo code applied! {discount_percent}% off (-{format_currency(discount_amount)})"
    })

@app.route("/api/orders", methods=["POST"])
def create_order():
    data = request.json or {}
    items = data.get("items", [])
    if not items:
        return jsonify({"error": "Shopping cart is empty."}), 400

    customer_name = data.get("customer_name", "").strip()
    customer_phone = data.get("customer_phone", "").strip()
    customer_email = data.get("customer_email", "").strip()
    address = data.get("address", "").strip()
    city = data.get("city", "").strip()
    notes = data.get("notes", "").strip()
    payment_method = data.get("payment_method", "cod")
    coupon_code = data.get("coupon_code", "").strip().upper()

    if not customer_name or not customer_phone or not address or not city:
        return jsonify({"error": "Please provide your full name, phone number, address, and city."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Calculate subtotal and verify item stock
    subtotal = 0.0
    verified_items = []
    for item in items:
        pid = item.get("id")
        qty = int(item.get("quantity", 1))
        row = cursor.execute("SELECT * FROM products WHERE id = ?", (pid,)).fetchone()
        if not row:
            continue
        item_price = float(row["price"])
        item_subtotal = round(item_price * qty, 2)
        subtotal += item_subtotal
        verified_items.append({
            "product_id": pid,
            "name": row["name"],
            "image": row["image_url"],
            "price": item_price,
            "quantity": qty,
            "subtotal": item_subtotal
        })

    if not verified_items:
        conn.close()
        return jsonify({"error": "No valid products in cart."}), 400

    subtotal = round(subtotal, 2)

    # Calculate discount
    discount = 0.0
    if coupon_code:
        coupon = cursor.execute("SELECT * FROM coupons WHERE UPPER(code) = ? AND is_active = 1", (coupon_code,)).fetchone()
        if coupon and subtotal >= float(coupon["min_order_amount"]):
            discount = round(subtotal * (float(coupon["discount_percent"]) / 100.0), 2)

    # Shipping fee calculation
    free_threshold = float(get_setting("free_shipping_threshold", "75.00"))
    delivery_fee = 0.0 if (subtotal - discount) >= free_threshold else float(get_setting("delivery_fee", "5.00"))

    total = round(max(0, subtotal - discount + delivery_fee), 2)

    # Generate unique Order Code (e.g. BZ-48291)
    random_digits = "".join(random.choices(string.digits, k=5))
    order_code = f"BZ-{random_digits}"

    # Insert Order
    cursor.execute("""
        INSERT INTO orders (
            order_code, customer_name, customer_phone, customer_email, address, city, 
            notes, payment_method, subtotal, discount, shipping_fee, total, status, coupon_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    """, (
        order_code, customer_name, customer_phone, customer_email, address, city,
        notes, payment_method, subtotal, discount, delivery_fee, total, coupon_code
    ))
    order_id = cursor.lastrowid

    # Insert items & decrease stock
    for vi in verified_items:
        cursor.execute("""
            INSERT INTO order_items (order_id, product_id, product_name, product_image, price, quantity, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (order_id, vi["product_id"], vi["name"], vi["image"], vi["price"], vi["quantity"], vi["subtotal"]))

        # Deduct stock (ensure non-negative)
        cursor.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (vi["quantity"], vi["product_id"]))

    conn.commit()
    conn.close()

    # Build WhatsApp message link for owner/customer direct confirmation
    whatsapp_num = get_setting("whatsapp_number", "").replace("+", "").replace(" ", "").replace("-", "")
    items_summary = "%0A".join([f"• {it['quantity']}x {it['name']} ({format_currency(it['subtotal'])})" for it in verified_items])
    wa_text = f"✨ *New Order from Baza Shop!*%0A*Order Code:* {order_code}%0A*Customer:* {customer_name}%0A*Phone:* {customer_phone}%0A*Address:* {address}, {city}%0A*Total:* {format_currency(total)}%0A%0A*Items:*%0A{items_summary}"
    whatsapp_link = f"https://wa.me/{whatsapp_num}?text={wa_text}" if whatsapp_num else ""

    return jsonify({
        "success": True,
        "order_code": order_code,
        "total": total,
        "subtotal": subtotal,
        "discount": discount,
        "shipping_fee": delivery_fee,
        "whatsapp_link": whatsapp_link,
        "message": f"Order {order_code} placed successfully! Thank you for shopping with Baza Shop."
    })

@app.route("/api/orders/track/<order_code>", methods=["GET"])
def track_order(order_code):
    conn = get_db_connection()
    order = conn.execute("SELECT * FROM orders WHERE UPPER(order_code) = ?", (order_code.strip().upper(),)).fetchone()
    if not order:
        conn.close()
        return jsonify({"error": "Order not found. Please check your order code."}), 404

    order_dict = dict(order)
    items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (order["id"],)).fetchall()
    order_dict["items"] = [dict(it) for it in items]
    conn.close()
    return jsonify(order_dict)

# ----------------- ADMIN API ----------------- #

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.json or {}
    pin = data.get("pin", "").strip()
    stored_pin = get_setting("admin_pin", "admin123")

    if pin == stored_pin:
        session["is_admin"] = True
        return jsonify({"success": True, "message": "Admin authenticated successfully."})
    return jsonify({"error": "Incorrect Admin PIN / Password."}), 401

@app.route("/api/admin/reset-password", methods=["POST"])
def admin_reset_password():
    data = request.json or {}
    recovery_key = data.get("recovery_key", "").strip()
    new_pin = data.get("new_pin", "").strip()

    if not new_pin or len(new_pin) < 3:
        return jsonify({"error": "New password must be at least 3 characters long."}), 400

    stored_key = get_setting("recovery_key", "BAZA-RESET-2026")
    if recovery_key != stored_key:
        return jsonify({"error": "Incorrect Master Recovery Key. Please check your recovery key."}), 400

    conn = get_db_connection()
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_pin', ?)", (new_pin,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Password updated successfully! You can now log in with your new PIN."})

@app.route("/api/admin/change-password", methods=["POST"])
@admin_required
def admin_change_password():
    data = request.json or {}
    current_pin = data.get("current_pin", "").strip()
    new_pin = data.get("new_pin", "").strip()

    stored_pin = get_setting("admin_pin", "admin123")
    if current_pin != stored_pin:
        return jsonify({"error": "Incorrect current password. Please enter your existing PIN."}), 400

    if not new_pin or len(new_pin) < 3:
        return jsonify({"error": "New password must be at least 3 characters long."}), 400

    conn = get_db_connection()
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_pin', ?)", (new_pin,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Password changed successfully!"})

@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.pop("is_admin", None)
    return jsonify({"success": True})

@app.route("/api/admin/check-auth", methods=["GET"])
def admin_check_auth():
    return jsonify({"authenticated": bool(session.get("is_admin"))})

@app.route("/api/admin/metrics", methods=["GET"])
@admin_required
def admin_metrics():
    conn = get_db_connection()

    total_revenue = conn.execute("SELECT COALESCE(SUM(total), 0) FROM orders WHERE status != 'cancelled'").fetchone()[0]
    total_orders = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    total_products = conn.execute("SELECT COUNT(*) FROM products WHERE status = 'active'").fetchone()[0]
    low_stock_count = conn.execute("SELECT COUNT(*) FROM products WHERE stock < 5 AND status = 'active'").fetchone()[0]
    pending_orders = conn.execute("SELECT COUNT(*) FROM orders WHERE status = 'pending'").fetchone()[0]

    # Status distribution
    status_counts = conn.execute("""
        SELECT status, COUNT(*) as count FROM orders GROUP BY status
    """).fetchall()

    # Recent orders
    recent_orders = conn.execute("""
        SELECT * FROM orders ORDER BY created_at DESC LIMIT 5
    """).fetchall()

    conn.close()

    return jsonify({
        "revenue": round(total_revenue, 2),
        "orders_count": total_orders,
        "products_count": total_products,
        "low_stock_count": low_stock_count,
        "pending_orders": pending_orders,
        "status_distribution": {r["status"]: r["count"] for r in status_counts},
        "recent_orders": [dict(ro) for ro in recent_orders]
    })

@app.route("/api/admin/upload", methods=["POST"])
@admin_required
def admin_upload_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in upload request."}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected."}), 400
    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        clean_name = f"baza_{int(datetime.now().timestamp())}_{random.randint(1000, 9999)}.{ext}"
        save_path = os.path.join(UPLOAD_FOLDER, clean_name)
        file.save(save_path)
        return jsonify({
            "success": True, 
            "image_url": f"/static/uploads/{clean_name}",
            "filename": file.filename
        })
    return jsonify({"error": "Unsupported file format. Please upload JPG, PNG, WEBP, or GIF."}), 400

@app.route("/api/admin/products", methods=["GET", "POST"])
@admin_required
def admin_products():
    conn = get_db_connection()

    if request.method == "GET":
        rows = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
        conn.close()
        products = []
        for r in rows:
            p = dict(r)
            if p.get("specs"):
                try:
                    p["specs"] = json.loads(p["specs"])
                except:
                    pass
            products.append(p)
        return jsonify(products)

    # POST: Add new product
    data = request.json or {}
    name = data.get("name", "").strip()
    category = data.get("category", "").strip()
    price = float(data.get("price", 0))
    compare_at_price = float(data.get("compare_at_price", 0)) if data.get("compare_at_price") else None
    stock = int(data.get("stock", 10))
    image_url = data.get("image_url", "").strip() or "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&auto=format&fit=crop&q=80"
    description = data.get("description", "").strip()
    specs = data.get("specs", {})
    is_featured = 1 if data.get("is_featured") else 0
    is_trending = 1 if data.get("is_trending") else 0

    if not name or not category or price <= 0:
        conn.close()
        return jsonify({"error": "Product name, category, and valid price are required."}), 400

    slug_base = name.lower().replace(" ", "-").replace("/", "-")
    slug = f"{slug_base}-{random.randint(100, 999)}"

    conn.execute("""
        INSERT INTO products (name, slug, category, price, compare_at_price, stock, image_url, description, specs, is_featured, is_trending)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (name, slug, category, price, compare_at_price, stock, image_url, description, json.dumps(specs), is_featured, is_trending))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Product added successfully!"})

@app.route("/api/admin/products/<int:product_id>", methods=["PUT", "DELETE"])
@admin_required
def admin_product_detail(product_id):
    conn = get_db_connection()

    if request.method == "DELETE":
        conn.execute("UPDATE products SET status = 'archived' WHERE id = ?", (product_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Product removed from store."})

    # PUT: Edit product
    data = request.json or {}
    name = data.get("name", "").strip()
    category = data.get("category", "").strip()
    price = float(data.get("price", 0))
    compare_at_price = float(data.get("compare_at_price", 0)) if data.get("compare_at_price") else None
    stock = int(data.get("stock", 0))
    image_url = data.get("image_url", "").strip()
    description = data.get("description", "").strip()
    specs = data.get("specs", {})
    is_featured = 1 if data.get("is_featured") else 0
    is_trending = 1 if data.get("is_trending") else 0
    status = data.get("status", "active")

    conn.execute("""
        UPDATE products 
        SET name = ?, category = ?, price = ?, compare_at_price = ?, stock = ?, image_url = ?, 
            description = ?, specs = ?, is_featured = ?, is_trending = ?, status = ?
        WHERE id = ?
    """, (name, category, price, compare_at_price, stock, image_url, description, json.dumps(specs), is_featured, is_trending, status, product_id))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Product updated successfully!"})

@app.route("/api/admin/orders", methods=["GET"])
@admin_required
def admin_orders():
    status = request.args.get("status", "")
    search = request.args.get("search", "").strip()

    conn = get_db_connection()
    query = "SELECT * FROM orders WHERE 1=1"
    params = []

    if status and status != "All":
        query += " AND status = ?"
        params.append(status)

    if search:
        query += " AND (order_code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard])

    query += " ORDER BY created_at DESC"
    rows = conn.execute(query, params).fetchall()

    orders = []
    for r in rows:
        order = dict(r)
        items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (order["id"],)).fetchall()
        order["items"] = [dict(it) for it in items]
        orders.append(order)

    conn.close()
    return jsonify(orders)

@app.route("/api/admin/orders/<int:order_id>/status", methods=["PUT"])
@admin_required
def admin_update_order_status(order_id):
    data = request.json or {}
    new_status = data.get("status", "").strip().lower()
    valid_statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]

    if new_status not in valid_statuses:
        return jsonify({"error": f"Invalid status. Must be one of {valid_statuses}"}), 400

    conn = get_db_connection()
    conn.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Order status updated to {new_status}."})

@app.route("/api/admin/coupons", methods=["GET", "POST"])
@admin_required
def admin_coupons():
    conn = get_db_connection()
    if request.method == "GET":
        rows = conn.execute("SELECT * FROM coupons ORDER BY id DESC").fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])

    # POST: create coupon
    data = request.json or {}
    code = data.get("code", "").strip().upper()
    discount_percent = float(data.get("discount_percent", 10))
    min_order_amount = float(data.get("min_order_amount", 0))

    if not code:
        conn.close()
        return jsonify({"error": "Coupon code is required."}), 400

    try:
        conn.execute("""
            INSERT INTO coupons (code, discount_percent, min_order_amount, is_active)
            VALUES (?, ?, ?, 1)
        """, (code, discount_percent, min_order_amount))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": "Coupon code already exists."}), 400

    conn.close()
    return jsonify({"success": True, "message": f"Coupon {code} created!"})

@app.route("/api/admin/coupons/<int:coupon_id>", methods=["DELETE"])
@admin_required
def admin_delete_coupon(coupon_id):
    conn = get_db_connection()
    conn.execute("DELETE FROM coupons WHERE id = ?", (coupon_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Coupon deleted."})

@app.route("/api/admin/settings", methods=["GET", "POST"])
@admin_required
def admin_settings():
    conn = get_db_connection()
    if request.method == "GET":
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        conn.close()
        return jsonify({r["key"]: r["value"] for r in rows})

    # POST: update settings
    data = request.json or {}
    for key, value in data.items():
        if value is not None:
            conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Settings updated successfully!"})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
