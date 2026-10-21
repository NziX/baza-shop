# ✨ Baza Shop - Modern E-Commerce Platform & Owner Control Panel

A sleek, modern, and responsive e-commerce web application with a dedicated Owner Control Panel built for **Baza Shop** ([@baza_shop2](https://www.instagram.com/baza_shop2)), specializing in modern chandeliers, smart ambient lamps, and premium home decor aesthetics.

---

## 🌟 Key Features

### 🛍️ Customer Storefront (`/`)
- **Designer Catalog**: Dynamic product grid with instant search and category filtering (*Chandeliers, Floor Lamps, Pendant Lights, Table Lamps, Decor Lighting, Home Decor*).
- **Product Quick View**: Interactive modal with detailed specs, ratings, and high-resolution visuals.
- **Cart & Slide-out Drawer**: Real-time quantity controls, automated subtotal calculations, and free shipping progress tracker.
- **Dynamic Checkout**: Clean modal with form validation, discount promo codes, payment options (Cash on Delivery / Mobile Money), and automated total calculation.
- **Rwandan Francs (RWF)**: Native currency formatting without decimals (e.g. `149,000 RWF`).
- **Direct WhatsApp Confirmation**: Generates a pre-formatted WhatsApp message containing order code, customer address, and items list for instant order fulfillment.
- **Live Order Tracking**: Customers can track real-time order status (*Pending → Processing → Shipped → Delivered*) using their unique `BZ-XXXXX` order code.

---

### 🛡️ Owner Control Panel (`/admin`)
- **PIN-Protected Dashboard**: Real-time sales revenue in RWF, order counts, product counts, and recent orders.
- **Drag & Drop Product Creation**: Drop photos directly from your device (desktop, phone, tablet) to instantly upload and add products without needing external image links.
- **Catalog Management**: Live search, stock level indicators, edit product details, toggle featured/trending status, and delete products.
- **Order Management**: View detailed customer info, delivery address, ordered line items, and change order status with instant feedback.
- **Promo Codes & Coupons**: Create percentage-based discount codes with spend thresholds in RWF.
- **Store Settings**: Customize store name, announcement banner, delivery fee, free shipping threshold, and WhatsApp order number.
- **Security & Password Management**: 
  - Change PIN securely from inside the Control Panel.
  - "Forgot PIN / Reset" modal with Master Recovery Key on the login screen.
  - Command-line password reset utility (`reset_password.py`).

---

## 🛠️ Tech Stack

- **Backend**: Python 3.x, Flask 3.x
- **Database**: SQLite 3 (self-contained, auto-initializing)
- **Frontend**: HTML5, Tailwind CSS, Lucide Icons, Vanilla JavaScript (ES6+)
- **Storage**: Local filesystem storage for uploaded product imagery (`/static/uploads/`)

---

## 📂 Project Structure

```text
baza_shop/
├── app.py                  # Flask application & REST API routes
├── database.py             # SQLite schema definition & initialization
├── reset_password.py       # CLI PIN reset utility
├── requirements.txt        # Python dependencies
├── baza_shop.db            # SQLite database file (created on first run)
├── static/
│   ├── css/
│   │   └── style.css       # Custom styling & animations
│   ├── js/
│   │   ├── store.js        # Client-side storefront logic & cart
│   │   └── admin.js        # Owner Control Panel logic & photo dropzone
│   └── uploads/            # Uploaded product photos (.gitkeep preserved)
└── templates/
    ├── index.html          # Storefront customer interface
    └── admin.html          # Owner Control Panel interface
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+ installed on your computer.
- Git (optional, for cloning)

### 2. Installation
Clone or download this repository to your computer:
```bash
git clone https://github.com/NziX/baza-shop.git
cd baza-shop
```

Install dependencies:
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
python app.py
```

The database `baza_shop.db` and upload directory will be initialized automatically.

Open your browser:
- **Storefront:** [http://127.0.0.1:5000](http://127.0.0.1:5000)
- **Owner Control Panel:** [http://127.0.0.1:5000/admin](http://127.0.0.1:5000/admin)

---

## 🔐 Admin Credentials

- **Initial Admin PIN:** `123456`
- **Master Recovery Key:** `BAZA-RESET-2026`

*(You can change your PIN at any time inside the Owner Control Panel or from the login screen using the recovery key).*

---

## 📄 License

This project is open-source and free to use under the MIT License.
