from flask import Blueprint, request, jsonify
from db import get_conn
from utils import token_required
import pymysql

records_bp = Blueprint("records", __name__)

# -----------------------
# List all medical records for the authenticated user
# Optional search query ?q=
@records_bp.route("", methods=["GET"])
@token_required
def list_records():
    q = request.args.get("q")
    user_id = request.user.get("id")
    conn = get_conn()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            if q:
                like = f"%{q}%"
                cur.execute(
                    "SELECT * FROM medical_records WHERE user_id=%s AND (patient_name LIKE %s OR raw_text LIKE %s) ORDER BY created_at DESC",
                    (user_id, like, like)
                )
            else:
                cur.execute(
                    "SELECT * FROM medical_records WHERE user_id=%s ORDER BY created_at DESC",
                    (user_id,)
                )
            rows = cur.fetchall()
            return jsonify({"success": True, "records": rows})
    finally:
        conn.close()


# -----------------------
# Analytics / stats (total patients, diagnosis counts)
@records_bp.route("/stats", methods=["GET"])
@token_required
def records_stats():
    user_id = request.user.get("id")
    conn = get_conn()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            # total distinct patients (best-effort using patient_name)
            cur.execute("SELECT COUNT(DISTINCT patient_name) AS total_patients FROM medical_records WHERE user_id=%s", (user_id,))
            total_row = cur.fetchone() or {"total_patients": 0}

            # diagnosis counts (ignore NULL/empty)
            cur.execute(
                "SELECT diagnosis, COUNT(*) AS cnt FROM medical_records WHERE user_id=%s AND diagnosis IS NOT NULL AND TRIM(diagnosis) <> '' GROUP BY diagnosis ORDER BY cnt DESC",
                (user_id,)
            )
            diag_rows = cur.fetchall() or []

            # normalize output
            diagnoses = [{"diagnosis": r.get('diagnosis') or '', "count": int(r.get('cnt') or 0)} for r in diag_rows]

            return jsonify({"success": True, "total_patients": int(total_row.get('total_patients') or 0), "diagnoses": diagnoses})
    finally:
        conn.close()

# -----------------------
# Create a new record (can also be used manually if needed)
@records_bp.route("", methods=["POST"])
@token_required
def create_record():
    body = request.get_json() or {}
    user_id = request.user.get("id")
    patient_name = body.get("patient_name")
    raw_text = body.get("raw_text")
    diagnosis = body.get("diagnosis")
    medications = body.get("medications")
    age = body.get("age")
    sex = body.get("sex")
    blood_pressure = body.get("blood_pressure")
    weight = body.get("weight")
    height = body.get("height")
    temperature = body.get("temperature")
    patient_id = body.get("patient_id")
    record_date = body.get("date") or body.get("record_date")
    image_url = body.get("image_url")
    doctor_name = body.get("doctor_name")

    if not patient_name or not raw_text:
        return jsonify({"error": "patient_name and raw_text are required"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # If no patient_id supplied, generate a short unique identifier
            if not patient_id:
                import time, random
                patient_id = f"PID-{int(time.time())}-{random.randint(1000,9999)}"

            # coerce numeric fields: empty strings -> NULL; try to convert strings to numbers
            def _coerce_int(v):
                if v is None or v == '':
                    return None
                try:
                    return int(v)
                except Exception:
                    try:
                        return int(float(v))
                    except Exception:
                        return None

            def _coerce_float(v):
                if v is None or v == '':
                    return None
                try:
                    return float(v)
                except Exception:
                    return None

            age_val = _coerce_int(age)
            weight_val = _coerce_float(weight)
            height_val = _coerce_float(height)
            temp_val = _coerce_float(temperature)

            cur.execute(
                "INSERT INTO medical_records (user_id, patient_name, patient_id, raw_text, diagnosis, medications, age, sex, blood_pressure, weight, height, temperature, record_date, image_url, doctor_name) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (user_id, patient_name, patient_id, raw_text, diagnosis, medications, age_val, sex, blood_pressure, weight_val, height_val, temp_val, record_date, image_url, doctor_name)
            )
            conn.commit()
            new_id = cur.lastrowid
            # Fetch the full record to return
            cur.execute("SELECT * FROM medical_records WHERE id=%s", (new_id,))
            new_rec = cur.fetchone()
            # Create an audit log for record creation
            try:
                with conn.cursor() as logcur:
                    details = f"Created medical record {new_id} for patient {patient_name}"
                    logcur.execute("INSERT INTO audit_logs (user_id, action, details) VALUES (%s,%s,%s)", (user_id, 'record_created', details))
                    conn.commit()
            except Exception:
                # Don't fail the main request if audit log insertion fails
                pass
            return jsonify({"success": True, "record_id": new_id, "record": new_rec}), 201
    finally:
        conn.close()

# -----------------------
# Fetch a single record by ID
@records_bp.route("/<int:rec_id>", methods=["GET"])
@token_required
def get_record(rec_id):
    user_id = request.user.get("id")
    conn = get_conn()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                "SELECT * FROM medical_records WHERE id=%s AND user_id=%s",
                (rec_id, user_id)
            )
            r = cur.fetchone()
            if not r:
                return jsonify({"error": "Record not found"}), 404
            return jsonify({"success": True, "record": r})
    finally:
        conn.close()

# -----------------------
# Update a record by ID
@records_bp.route("/<int:rec_id>", methods=["PUT"])
@token_required
def update_record(rec_id):
    body = request.get_json() or {}
    user_id = request.user.get("id")

    fields = []
    values = []
    # Helper coercion for numeric values to avoid MySQL type errors
    def _coerce_int(v):
        if v is None or v == '':
            return None
        try:
            return int(v)
        except Exception:
            try:
                return int(float(v))
            except Exception:
                return None

    def _coerce_float(v):
        if v is None or v == '':
            return None
        try:
            return float(v)
        except Exception:
            return None

    for key in ("patient_name", "patient_id", "raw_text", "diagnosis", "medications", "age", "sex", "blood_pressure", "weight", "height", "temperature", "date", "record_date", "image_url", "doctor_name"):
        if key in body:
            # Map frontend 'date' to DB column 'record_date'
            col = 'record_date' if key in ("date", "record_date") else key
            val = body[key]
            # coerce numeric fields
            if key == 'age':
                val = _coerce_int(val)
            if key in ('weight', 'height', 'temperature'):
                val = _coerce_float(val)
            fields.append(f"{col}=%s")
            values.append(val)

    if not fields:
        return jsonify({"error": "No fields provided"}), 400

    values.extend([rec_id, user_id])
    sql = f"UPDATE medical_records SET {', '.join(fields)} WHERE id=%s AND user_id=%s"

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(values))
            conn.commit()
            # Fetch and return the updated record for client convenience
            with conn.cursor(pymysql.cursors.DictCursor) as cur2:
                cur2.execute("SELECT * FROM medical_records WHERE id=%s AND user_id=%s", (rec_id, user_id))
                updated = cur2.fetchone()
            return jsonify({"success": True, "record": updated})
    finally:
        conn.close()

# -----------------------
# Delete a record by ID
@records_bp.route("/<int:rec_id>", methods=["DELETE"])
@token_required
def delete_record(rec_id):
    user_id = request.user.get("id")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM medical_records WHERE id=%s AND user_id=%s",
                (rec_id, user_id)
            )
            conn.commit()
            # Create an audit log for record deletion
            try:
                with conn.cursor() as logcur:
                    details = f"Deleted medical record {rec_id}"
                    logcur.execute("INSERT INTO audit_logs (user_id, action, details) VALUES (%s,%s,%s)", (user_id, 'record_deleted', details))
                    conn.commit()
            except Exception:
                pass
            return jsonify({"success": True})
    finally:
        conn.close()
