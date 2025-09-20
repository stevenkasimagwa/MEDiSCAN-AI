from flask import Blueprint, request, jsonify
from db import get_conn
from utils import token_required, check_unique_username, hash_password

doctors_bp = Blueprint("doctors", __name__)

# ------------------ LIST DOCTORS ------------------
@doctors_bp.route("", methods=["GET"])
@token_required
def list_doctors():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Return all users with role 'doctor' or 'admin' (exclude the built-in main admin with username 'admin')
            cur.execute("""
                SELECT u.id as id, u.username as username, u.name as doctor_name, u.role as role,
                       d.specialization as specialization, COALESCE(d.created_at, u.created_at) as created_at
                FROM users u
                LEFT JOIN doctors d ON d.username = u.username
                WHERE u.role IN ('doctor','admin') AND u.username != 'admin'
                ORDER BY COALESCE(d.created_at, u.created_at) DESC
            """)
            doctors = cur.fetchall()
            return jsonify({"success": True, "doctors": doctors})
    finally:
        conn.close()

# ------------------ CREATE DOCTOR ------------------
@doctors_bp.route("", methods=["POST"])
@token_required
def create_doctor():
    data = request.get_json() or {}
    username = data.get("username")
    name = data.get("name")
    specialization = data.get("specialization")
    password = data.get("password")
    role = data.get("role", "doctor")

    if not username or not name:
        return jsonify({"error": "username and name are required"}), 400

    if not password:
        return jsonify({"error": "password is required for new doctor accounts"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Check username uniqueness across users table
            if not check_unique_username(username):
                return jsonify({"error": "username already exists"}), 409

            # Create the user record so the doctor can sign in
            pw_hash = hash_password(password)
            cur.execute(
                "INSERT INTO users (username, name, password_hash, role) VALUES (%s, %s, %s, %s)",
                (username, name, pw_hash, role)
            )

            # Insert doctor profile
            cur.execute(
                "INSERT INTO doctors (username, name, specialization, role) VALUES (%s, %s, %s, %s)",
                (username, name, specialization, role)
            )
            # Record audit log with acting user if available
            try:
                actor_id = request.user.get('id') if hasattr(request, 'user') and request.user else None
            except Exception:
                actor_id = None

            cur.execute(
                "INSERT INTO audit_logs (user_id, action, details) VALUES (%s,%s,%s)",
                (actor_id, 'CREATE', f"Created doctor account: {username}")
            )

            conn.commit()

            # Fetch created doctor row to return a consistent object
            doctor_id = cur.lastrowid
            cur.execute("SELECT id, username, name AS doctor_name, role, specialization, created_at FROM doctors WHERE id=%s", (doctor_id,))
            doctor = cur.fetchone()
            return jsonify({"success": True, "doctor": doctor}), 201
    finally:
        conn.close()

# ------------------ UPDATE DOCTOR ------------------
@doctors_bp.route("/<int:id>", methods=["PUT"])
@token_required
def update_doctor(id):
    data = request.get_json() or {}
    new_username = data.get("username")
    new_name = data.get("name")
    specialization = data.get("specialization")
    role = data.get("role")

    if not new_username or not new_name:
        return jsonify({"error": "username and name are required"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Determine username from supplied id (id is users.id)
            cur.execute("SELECT username FROM users WHERE id=%s", (id,))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "user not found"}), 404
            current_username = row.get('username') if isinstance(row, dict) else row[0]

            # Update users table
            cur.execute(
                "UPDATE users SET username=%s, name=%s, role=%s WHERE id=%s",
                (new_username, new_name, role or 'doctor', id)
            )

            # Update doctors profile if exists
            cur.execute(
                "UPDATE doctors SET username=%s, name=%s, specialization=%s, role=%s WHERE username=%s",
                (new_username, new_name, specialization, role or 'doctor', current_username)
            )

            # write audit log for update
            try:
                actor_id = request.user.get('id') if hasattr(request, 'user') and request.user else None
            except Exception:
                actor_id = None

            details = f"Updated doctor: {current_username} -> {new_username}; role={role}; specialization={specialization}"
            cur.execute("INSERT INTO audit_logs (user_id, action, details) VALUES (%s,%s,%s)", (actor_id, 'UPDATE', details))

            conn.commit()
            return jsonify({"success": True})
    finally:
        conn.close()

# ------------------ DELETE DOCTOR ------------------
@doctors_bp.route("/<int:id>", methods=["DELETE"])
@token_required
def delete_doctor(id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Try to find doctor by doctors.id first
            cur.execute("SELECT username FROM doctors WHERE id=%s", (id,))
            row = cur.fetchone()
            username = None
            if row:
                username = row.get('username') if isinstance(row, dict) else row[0]
                # delete by doctors.id
                cur.execute("DELETE FROM doctors WHERE id=%s", (id,))
                # also delete user by username
                if username:
                    cur.execute("DELETE FROM users WHERE username=%s", (username,))
            else:
                # If not found, maybe id is users.id; get username
                cur.execute("SELECT username FROM users WHERE id=%s", (id,))
                urow = cur.fetchone()
                if not urow:
                    return jsonify({"error": "user/doctor not found"}), 404
                username = urow.get('username') if isinstance(urow, dict) else urow[0]
                # delete doctor profile by username
                cur.execute("DELETE FROM doctors WHERE username=%s", (username,))
                # delete user by id
                cur.execute("DELETE FROM users WHERE id=%s", (id,))

            # record audit log for deletion
            try:
                actor_id = request.user.get('id') if hasattr(request, 'user') and request.user else None
            except Exception:
                actor_id = None

            del_details = f"Deleted doctor account and profile: {username}"
            cur.execute("INSERT INTO audit_logs (user_id, action, details) VALUES (%s,%s,%s)", (actor_id, 'DELETE', del_details))

            conn.commit()
            return jsonify({"success": True})
    finally:
        conn.close()
