from flask import Blueprint, request, jsonify
from db import get_conn
from utils import token_required

audit_bp = Blueprint("audit", __name__)

@audit_bp.route("", methods=["GET"])
@token_required
def get_logs():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Join audit logs with users to supply doctor name/username for frontend
            cur.execute("""
                SELECT a.id, a.user_id, a.action, a.details, a.created_at,
                       u.name AS doctor_name, u.username AS username
                FROM audit_logs a
                LEFT JOIN users u ON u.id = a.user_id
                ORDER BY a.created_at DESC
                LIMIT 500
            """)
            rows = cur.fetchall()
            # Map rows to include a `profiles` object expected by the frontend
            logs = []
            for r in rows:
                logs.append({
                    'id': r.get('id') if isinstance(r, dict) else r[0],
                    'user_id': r.get('user_id') if isinstance(r, dict) else r[1],
                    'action': r.get('action') if isinstance(r, dict) else r[2],
                    'details': r.get('details') if isinstance(r, dict) else r[3],
                    'created_at': r.get('created_at') if isinstance(r, dict) else r[4],
                    'profiles': {
                        'doctor_name': r.get('doctor_name') if isinstance(r, dict) else r[5],
                        'username': r.get('username') if isinstance(r, dict) else r[6]
                    }
                })
            return jsonify({"logs": logs})
    finally:
        conn.close()

@audit_bp.route("", methods=["POST"])
def create_log():
    # allow main API to create logs without token for internal use; you can add token_required if desired
    body = request.get_json() or {}
    user_id = body.get("user_id")
    action = body.get("action")
    details = body.get("details")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO audit_logs (user_id, action, details) VALUES (%s,%s,%s)", (user_id, action, details))
            conn.commit()
            return jsonify({"id": cur.lastrowid}), 201
    finally:
        conn.close()


@audit_bp.route("/<int:log_id>", methods=["DELETE"])
@token_required
def delete_log(log_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM audit_logs WHERE id=%s", (log_id,))
            conn.commit()
            return jsonify({}), 204
    finally:
        conn.close()
