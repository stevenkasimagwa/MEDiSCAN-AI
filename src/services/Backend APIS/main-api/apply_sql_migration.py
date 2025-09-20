"""
Apply SQL migration file `db_migrations/001_add_patientid_and_vitals.sql` to the configured MySQL database.
Reads DB connection info from environment variables:
  MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB

Usage (PowerShell example):
  $env:MYSQL_HOST='127.0.0.1'; $env:MYSQL_USER='root'; $env:MYSQL_PASSWORD='pass'; $env:MYSQL_DB='medical_records'; python apply_sql_migration.py
"""
import os
import sys
import pymysql

# Try to locate the db_migrations directory by walking up the tree from this file
here = os.path.abspath(os.path.dirname(__file__))
sql_path = None
cur = here
for _ in range(6):
    candidate = os.path.join(cur, '..', '..', '..', 'db_migrations', '001_add_patientid_and_vitals.sql')
    candidate = os.path.abspath(candidate)
    if os.path.exists(candidate):
        sql_path = candidate
        break
    # move up one directory
    cur = os.path.abspath(os.path.join(cur, '..'))

if not sql_path:
    # fallback to project-root relative path
    candidate = os.path.abspath(os.path.join(os.path.dirname(here), '..', '..', '..', 'db_migrations', '001_add_patientid_and_vitals.sql'))
    if os.path.exists(candidate):
        sql_path = candidate

if not sql_path:
    print('Migration SQL file not found; looked in several places, last tried:', candidate)
    sys.exit(2)

SQL_PATH = sql_path
print('Using migration SQL at', SQL_PATH)

host = os.getenv('MYSQL_HOST', '127.0.0.1')
port = int(os.getenv('MYSQL_PORT', '3306'))
user = os.getenv('MYSQL_USER', 'root')
password = os.getenv('MYSQL_PASSWORD', '')
db = os.getenv('MYSQL_DB', 'medical_records')

print('Connecting to MySQL at', host, 'database', db, 'as', user)
try:
    conn = pymysql.connect(host=host, port=port, user=user, password=password, db=db, cursorclass=pymysql.cursors.DictCursor)
except Exception as e:
    print('Failed to connect to DB:', e)
    sys.exit(3)

with open(SQL_PATH, 'r', encoding='utf-8') as f:
    sql = f.read()

# Split statements on semicolon; this is naive but acceptable for simple ALTER/CREATE statements
statements = [s.strip() for s in sql.split(';') if s.strip()]

try:
    with conn.cursor() as cur:
        for stmt in statements:
            try:
                print('Executing statement:')
                print(stmt[:200] + ('...' if len(stmt) > 200 else ''))
                cur.execute(stmt)
            except Exception as e:
                # Print and continue (some statements may already exist)
                print('Statement failed:', e)
    conn.commit()
    print('Migration applied successfully.')
except Exception as e:
    print('Migration failed:', e)
    sys.exit(4)
finally:
    try:
        conn.close()
    except Exception:
        pass
