import os
import pymysql

# Simple .env parsing for required DB vars if present
env_path = os.path.join(os.path.dirname(__file__), '.env')
if not os.path.exists(env_path):
    # try parent folder
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')

config = {
    'host': os.getenv('MYSQL_HOST', '127.0.0.1'),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'database': os.getenv('MYSQL_DB', 'medical_records'),
    'port': int(os.getenv('MYSQL_PORT', 3306)),
}

# If .env exists, parse it for overrides
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' not in line:
                continue
            k, v = line.split('=', 1)
            k = k.strip()
            v = v.strip().strip('"')
            if k == 'MYSQL_HOST': config['host'] = v
            if k == 'MYSQL_USER': config['user'] = v
            if k == 'MYSQL_PASSWORD': config['password'] = v
            if k == 'MYSQL_DB': config['database'] = v
            if k == 'MYSQL_PORT':
                try:
                    config['port'] = int(v)
                except Exception:
                    pass

sql_path = os.path.join(os.path.dirname(__file__), 'migrations', '002_make_user_nullable.sql')
if not os.path.exists(sql_path):
    print('Migration file not found:', sql_path)
    raise SystemExit(1)

with open(sql_path, 'r', encoding='utf-8') as f:
    sql = f.read()

print('Connecting to DB', config['host'], config['database'], f"(port={config['port']})")
try:
    conn = pymysql.connect(host=config['host'], user=config['user'], password=config['password'], database=config['database'], port=config['port'])
    with conn.cursor() as cur:
        print('Executing migration...')
        cur.execute(sql)
        conn.commit()
        print('Migration applied successfully.')
except Exception as e:
    print('Migration failed:', str(e))
    raise
finally:
    try:
        conn.close()
    except:
        pass
