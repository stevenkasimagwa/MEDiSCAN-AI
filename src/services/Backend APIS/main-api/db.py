import os
import pymysql
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "127.0.0.1"),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "database": os.getenv("MYSQL_DB", "medical_records"),
    "port": int(os.getenv("MYSQL_PORT", 3306)),
    "cursorclass": pymysql.cursors.DictCursor,
    "autocommit": False
}

def get_conn():
    return pymysql.connect(**DB_CONFIG)
