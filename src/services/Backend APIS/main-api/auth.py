import os
from flask import Blueprint, request, jsonify
from db import get_conn
from utils import hash_password, check_password, create_token, token_required, check_unique_username
import pymysql

auth_bp = Blueprint("auth", __name__)

# ------------------ SIGNUP ------------------
@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    role = data.get("role", "doctor")
    name = data.get("name", "")

    if not username or not password:
        return jsonify({"error": "username and password required"}), 400

    # normalize role and validate
    try:
        role = str(role).strip().lower()
    except Exception:
        role = 'doctor'

    if role not in ('doctor', 'admin', 'staff'):
        role = 'doctor'

    # Prevent creating the built-in admin via signup
    if username == 'admin':
        return jsonify({"error": "Cannot create built-in admin user"}), 403

    # quick uniqueness check to short-circuit DB error
    try:
        if not check_unique_username(username):
            return jsonify({"error": "user already exists"}), 409
    except Exception:
        # fallback to DB insert which will handle integrity
        pass

    pw_hash = hash_password(password)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (username, name, password_hash, role) VALUES (%s, %s, %s, %s)",
                (username, name, pw_hash, role)
            )
            conn.commit()
            user_id = cur.lastrowid
            return jsonify({"success": True, "user": {"id": user_id, "username": username, "name": name, "role": role}}), 201
    except pymysql.err.IntegrityError:
        conn.rollback()
        return jsonify({"error": "user already exists"}), 409
    finally:
        conn.close()

# ------------------ SIGNIN ------------------
@auth_bp.route("/signin", methods=["POST"])
def signin():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "username and password required"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, name, password_hash, role FROM users WHERE username=%s",
                (username,)
            )
            user = cur.fetchone()
            if not user:
                print(f"Signin failed: user {username} not found")
                return jsonify({"error": "invalid credentials"}), 401

            try:
                ok = check_password(password, user["password_hash"])
            except Exception as e:
                print(f"Error checking password for user {username}: {e}")
                ok = False

            if not ok:
                print(f"Signin failed: invalid password for {username}")
                return jsonify({"error": "invalid credentials"}), 401

            # Ensure the built-in 'admin' username always has admin role even if DB row was mutated
            try:
                if user.get('username') == 'admin' and user.get('role') != 'admin':
                    try:
                        cur.execute("UPDATE users SET role=%s WHERE username=%s", ('admin', 'admin'))
                        conn.commit()
                        user['role'] = 'admin'
                    except Exception:
                        # best-effort: if update fails, continue with fetched role
                        pass
            except Exception:
                pass

            token = create_token(user["id"], user["username"], user.get("role") or 'doctor')
            # pyjwt may return a bytes object on some versions; ensure we return a str
            try:
                if isinstance(token, (bytes, bytearray)):
                    token = token.decode('utf-8')
            except Exception:
                pass
            # Insert audit log for login
            try:
                with conn.cursor() as cur:
                    cur.execute("INSERT INTO audit_logs (user_id, action, details) VALUES (%s,%s,%s)", (user["id"], 'LOGIN', f"User {user['username']} logged in"))
                    conn.commit()
            except Exception:
                pass

            return jsonify({
                "access_token": token,
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "name": user["name"],
                    "role": user["role"]
                }
            })
    finally:
        conn.close()

# ------------------ GET CURRENT USER ------------------
@auth_bp.route("/me", methods=["GET"])
@token_required
def me():
    u = request.user
    return jsonify({
        "id": u["id"],
        "username": u["username"],
        "name": u.get("name", ""),
        "role": u["role"]
    })


# ------------------ DELETE CURRENT USER ------------------
@auth_bp.route("/delete", methods=["DELETE"])
@token_required
def delete_current_user():
    # delete the current authenticated user and corresponding doctor profile
    u = request.user
    user_id = u.get('id')
    username = u.get('username')
    # Prevent deletion of the built-in main admin
    if username == 'admin':
        return jsonify({"error": "Cannot delete main admin account"}), 403
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # delete doctor profile if exists
            cur.execute("DELETE FROM doctors WHERE username=%s", (username,))
            # delete user
            cur.execute("DELETE FROM users WHERE id=%s", (user_id,))
            # insert audit log for deletion
            cur.execute("INSERT INTO audit_logs (user_id, action, details) VALUES (%s,%s,%s)", (user_id, 'DELETE', f"Deleted account: {username}"))
            conn.commit()
            return jsonify({"success": True})
    finally:
        conn.close()


@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout():
    u = request.user
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("INSERT INTO audit_logs (user_id, action, details) VALUES (%s,%s,%s)", (u.get('id'), 'LOGOUT', f"User {u.get('username')} logged out"))
            conn.commit()
    except Exception:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass
    return jsonify({"success": True})


@auth_bp.route('/change-password', methods=['POST'])
@token_required
def change_password():
    data = request.get_json() or {}
    current = data.get('current_password')
    new_pw = data.get('new_password')

    if not current or not new_pw:
        return jsonify({"error": "current_password and new_password required"}), 400

    u = request.user
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id=%s", (u.get('id'),))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "user not found"}), 404

            try:
                if not check_password(current, row['password_hash']):
                    return jsonify({"error": "current password incorrect"}), 403
            except Exception:
                return jsonify({"error": "error checking password"}), 500

            new_hash = hash_password(new_pw)
            cur.execute("UPDATE users SET password_hash=%s WHERE id=%s", (new_hash, u.get('id')))
            # audit log
            try:
                cur.execute("INSERT INTO audit_logs (user_id, action, details) VALUES (%s,%s,%s)", (u.get('id'), 'UPDATE', f"User {u.get('username')} changed password"))
            except Exception:
                pass
            conn.commit()
            return jsonify({"success": True})
    finally:
        conn.close()

@auth_bp.route('/reset-admin', methods=['POST'])
def reset_admin():
    # allow local reset for development only
    remote = request.remote_addr
    allowed_local = remote in (None, '127.0.0.1', '::1')
    header_secret = request.headers.get('X-LOCAL-RESET')
    secret_ok = header_secret and header_secret == os.getenv('LOCAL_RESET_SECRET', 'localdev')
    if not (allowed_local or secret_ok):
        return jsonify({"error": "Not allowed"}), 403

    # reset password to ADMIN_PASSWORD or default
    new_pw = os.getenv('ADMIN_PASSWORD', 'admin123')
    pw_hash = hash_password(new_pw)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Ensure the built-in admin has the correct role and name as well as the new password
            cur.execute("UPDATE users SET password_hash=%s, role=%s, name=%s WHERE username=%s", (pw_hash, 'admin', 'Administrator', 'admin'))
            conn.commit()
            return jsonify({"success": True, "message": "admin password reset and role enforced"})
    finally:
        conn.close()
