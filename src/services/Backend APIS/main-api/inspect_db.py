"""
Inspect the medical_records table: print column names and first 5 rows for key fields.
Reads DB connection info from env vars: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB

Usage (PowerShell example):
  $env:MYSQL_HOST='127.0.0.1'; $env:MYSQL_USER='root'; $env:MYSQL_PASSWORD='doncoleone'; $env:MYSQL_DB='medical_records'; python inspect_db.py
"""
import os
import sys
import pymysql

host = os.getenv('MYSQL_HOST', '127.0.0.1')
port = int(os.getenv('MYSQL_PORT', '3306'))
user = os.getenv('MYSQL_USER', 'root')
password = os.getenv('MYSQL_PASSWORD', '')
db = os.getenv('MYSQL_DB', 'medical_records')

print('Connecting to', host, 'db', db, 'as', user)
try:
    conn = pymysql.connect(host=host, port=port, user=user, password=password, db=db, cursorclass=pymysql.cursors.DictCursor)
except Exception as e:
    print('Failed to connect:', e)
    sys.exit(2)

try:
    with conn.cursor() as cur:
        print('\n=== Columns in medical_records ===')
        cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medical_records'")
        cols = cur.fetchall()
        for c in cols:
            print(c['COLUMN_NAME'], c['DATA_TYPE'])

        print('\n=== First 5 rows (id, patient_id, patient_name, weight, height, temperature, created_at) ===')
        cur.execute("SELECT id, patient_id, patient_name, weight, height, temperature, created_at FROM medical_records ORDER BY created_at DESC LIMIT 5")
        rows = cur.fetchall()
        if not rows:
            print('No rows found')
        for r in rows:
            print(r)

except Exception as e:
    print('Query failed:', e)
finally:
    try:
        conn.close()
    except Exception:
        pass
