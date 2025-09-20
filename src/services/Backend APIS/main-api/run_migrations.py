"""
Simple migration runner for main-api.

This script checks the `medical_records` table for the presence of
`blood_pressure` and `weight` columns and adds them if missing.

It reads DB connection parameters from environment variables:
  MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB

Usage (PowerShell):
  $env:MYSQL_HOST = '127.0.0.1'; $env:MYSQL_USER='root'; $env:MYSQL_PASSWORD='pass'; python run_migrations.py

Warning: Always backup your database before running migrations in production.
"""
import os
import sys
import pymysql
from pymysql.constants import ER


def get_conn():
    host = os.getenv('MYSQL_HOST', '127.0.0.1')
    port = int(os.getenv('MYSQL_PORT', '3306'))
    user = os.getenv('MYSQL_USER', 'root')
    password = os.getenv('MYSQL_PASSWORD', '')
    db = os.getenv('MYSQL_DB', 'meddigitize')
    return pymysql.connect(host=host, port=port, user=user, password=password, db=db, cursorclass=pymysql.cursors.DictCursor)


def column_exists(connection, table, column):
    with connection.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s
        """, (table, column))
        r = cur.fetchone()
        return bool(r and r.get('cnt', 0) > 0)


def add_column(connection, table, column, definition):
    sql = f"ALTER TABLE {table} ADD COLUMN {column} {definition};"
    with connection.cursor() as cur:
        print(f"Applying: {sql}")
        cur.execute(sql)
    connection.commit()


def main():
    table = 'medical_records'
    to_add = [
        ('blood_pressure', "VARCHAR(64) DEFAULT NULL"),
        ('weight', "VARCHAR(64) DEFAULT NULL"),
    ]

    try:
        conn = get_conn()
    except Exception as e:
        print("Failed to connect to DB:", e)
        sys.exit(2)

    try:
        for col, definition in to_add:
            if column_exists(conn, table, col):
                print(f"Column already exists: {col}")
            else:
                print(f"Column missing, adding: {col}")
                try:
                    add_column(conn, table, col, definition)
                    print(f"Added column {col}")
                except pymysql.err.InternalError as ie:
                    # For safety, print and continue
                    print(f"Failed to add column {col}:", ie)
        print("Migrations complete.")
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == '__main__':
    main()
