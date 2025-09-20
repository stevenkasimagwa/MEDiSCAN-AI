# utils.py
import os
import time
import jwt
from functools import wraps
from flask import request, jsonify
from dotenv import load_dotenv
import bcrypt

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "secret")
JWT_EXP_SECONDS = int(os.getenv("JWT_EXP_SECONDS", 86400))  # 24 hours default


# Password utilities
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# JWT utilities
def create_token(user_id: int, username: str, role: str) -> str:
    # Normalize role to a lowercase canonical value to avoid client mismatches
    try:
        norm_role = str(role).strip().lower() if role is not None else None
    except Exception:
        norm_role = role
    payload = {
        "sub": user_id,
        "username": username,
        "role": norm_role,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXP_SECONDS
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    # utils.py (add at the bottom)
from db import get_conn

def check_unique_username(username: str) -> bool:
    """Check if a username already exists in the users table."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username=%s", (username,))
            user = cur.fetchone()
            return user is None
    finally:
        conn.close()



# Decorator to protect routes
def token_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        # Allow preflight requests to pass through so Flask-CORS can handle them
        if request.method == 'OPTIONS':
            # Return a permissive preflight response so clients can proceed
            origin = request.headers.get('Origin')
            headers = {
                'Access-Control-Allow-Origin': origin or '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization,Content-Type',
            }
            return jsonify({}), 200, headers

        auth = request.headers.get("Authorization", None)
        if not auth or not auth.startswith("Bearer "):
            origin = request.headers.get('Origin')
            headers = {
                'Access-Control-Allow-Origin': origin or '*',
                'Access-Control-Allow-Headers': 'Authorization,Content-Type',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            }
            return jsonify({"error": "Missing or invalid Authorization header"}), 401, headers
        token = auth.split(" ", 1)[1]
        try:
            payload = decode_token(token)
            # Attach user info to request context
            # Normalize role on request context
            role = payload.get("role")
            try:
                if role is not None:
                    role = str(role).strip().lower()
            except Exception:
                pass
            request.user = {
                "id": payload["sub"],
                "username": payload.get("username"),
                "role": role
            }
        except Exception as e:
            origin = request.headers.get('Origin')
            headers = {
                'Access-Control-Allow-Origin': origin or '*',
                'Access-Control-Allow-Headers': 'Authorization,Content-Type',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            }
            return jsonify({"error": "Invalid or expired token", "detail": str(e)}), 401, headers
        return fn(*args, **kwargs)
    return wrapper
