import sys
import os
import sqlite3

DB_FILE = os.path.join(os.path.dirname(__file__), "baza_shop.db")

def reset_password(new_pin=None):
    if not new_pin:
        if len(sys.argv) > 1:
            new_pin = sys.argv[1].strip()
        else:
            new_pin = input("Enter new Admin PIN / Password: ").strip()

    if not new_pin:
        print("Error: Password cannot be empty.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_pin', ?)", (new_pin,))
    conn.commit()
    conn.close()

    print(f"\n[SUCCESS] Admin PIN successfully updated to: {new_pin}")
    print("You can now log in at: http://127.0.0.1:5000/admin\n")

if __name__ == "__main__":
    reset_password()
