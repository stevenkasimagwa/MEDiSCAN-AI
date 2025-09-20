import os
import uuid
import json
import requests
from flask import Blueprint, request, current_app, jsonify
from werkzeug.utils import secure_filename
from db import get_conn
from utils import token_required
import traceback
import pymysql

upload_bp = Blueprint("upload", __name__)

ALLOWED_EXT = {'.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.pdf'}


def allowed_file(filename):
    return os.path.splitext(filename)[1].lower() in ALLOWED_EXT


def sanitize_field(value, default=""):
    """Convert value to string, strip whitespace, serialize dicts/lists to JSON"""
    try:
        if value is None:
            return default
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        return str(value).strip()
    except Exception:
        return default


@upload_bp.route("/upload", methods=["POST"])
def upload_file():
    # Token is optional here: allow anonymous uploads (user_id can be null)
    user = getattr(request, "user", None)
    user_id = None
    try:
        if user:
            if isinstance(user, dict):
                user_id = int(user.get("id"))
            else:
                user_id = int(user)
    except Exception:
        user_id = None

    # -------------------
    # Step 1: Check file presence
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "No selected file"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file type"}), 400

    # -------------------
    # Step 2: Save file temporarily
    filename = secure_filename(file.filename)
    tmp_name = f"{uuid.uuid4().hex}_{filename}"
    save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], tmp_name)
    # ensure upload folder exists and is writable
    upload_folder = current_app.config.get('UPLOAD_FOLDER')
    if not upload_folder:
        return jsonify({"error": "Server misconfiguration: UPLOAD_FOLDER not set"}), 500
    if not os.path.isdir(upload_folder):
        try:
            os.makedirs(upload_folder, exist_ok=True)
        except Exception as e:
            return jsonify({"error": "Server cannot create upload folder", "detail": str(e)}), 500
    # attempt to save
    try:
        file.save(save_path)
    except Exception as e:
        tb = traceback.format_exc()
        try:
            current_app.logger.error("Failed to save uploaded file: %s", tb)
        except Exception:
            pass
        return jsonify({"error": "Failed to save uploaded file", "detail": str(e), "trace": tb}), 500

    # -------------------
    # Step 3: Call OCR service
    ocr_url = os.getenv("OCR_SERVICE_URL", "http://localhost:3002/api/ocr")
    extract_url = f"{ocr_url}/extract-fields"

    try:
        with open(save_path, "rb") as fh:
            files = {"file": (filename, fh, "application/octet-stream")}
            resp = requests.post(extract_url, files=files, timeout=30)
        # Do not raise_for_status here; read the OCR response and return its JSON so frontend can act on it
        try:
            j = resp.json()
        except Exception:
            return jsonify({"error": "Invalid OCR response", "detail": resp.text}), 502

        # If OCR responded but indicated failure, return that payload (client can handle recoverable errors)
        if not j.get("success"):
            return jsonify({"success": False, "ocr_error": j.get("error", "OCR failed"), "ocr_detail": j}), 200

        fields = j.get("fields", {})
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "Failed to call OCR service", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "Unexpected error calling OCR", "detail": str(e)}), 500

    # -------------------
    # Step 4: Sanitize & validate fields
    patient_name = sanitize_field(fields.get("patient_name"))
    raw_text = sanitize_field(fields.get("raw_text"))
    diagnosis = sanitize_field(fields.get("diagnosis"))
    medications = sanitize_field(fields.get("medications"))
    age = None
    try:
        age = int(fields.get('age')) if fields.get('age') else None
    except Exception:
        age = None
    blood_pressure = sanitize_field(fields.get('blood_pressure'))
    weight = sanitize_field(fields.get('weight'))
    sex = sanitize_field(fields.get('sex'))

    if not patient_name or not raw_text:
        return jsonify({"error": "Missing required OCR fields", "fields": fields}), 400

    # -------------------
    # Step 5: Persist to DB
    conn = None
    record_id = None
    def do_insert(connection):
        with connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO medical_records
                (user_id, patient_name, raw_text, diagnosis, medications, age, sex, blood_pressure, weight, image_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, patient_name, raw_text, diagnosis, medications, age, sex, blood_pressure, weight, save_path)
            )
            connection.commit()
            return cur.lastrowid

    try:
        conn = get_conn()
        try:
            record_id = do_insert(conn)
        except pymysql.err.OperationalError as op_err:
            # If the error indicates missing column(s), attempt to add them and retry once
            # MySQL error code 1054 = Unknown column
            errnum = op_err.args[0] if isinstance(op_err.args, tuple) and len(op_err.args) > 0 else None
            if errnum == 1054:
                try:
                    conn.close()
                except Exception:
                    pass
                try:
                    # Reconnect and run ALTER statements only for missing columns
                    migr_conn = get_conn()
                    try:
                        with migr_conn.cursor() as mcur:
                            # Check information_schema to see which columns are missing
                            mcur.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=%s AND TABLE_NAME='medical_records' AND COLUMN_NAME IN ('blood_pressure','weight')", (conn.db.decode() if hasattr(conn, 'db') and isinstance(conn.db, bytes) else os.getenv('MYSQL_DB', 'medical_records'),))
                            existing = {row[0] for row in mcur.fetchall()} if mcur.rowcount else set()
                            to_add = []
                            if 'blood_pressure' not in existing:
                                to_add.append("ALTER TABLE medical_records ADD COLUMN blood_pressure VARCHAR(64) DEFAULT NULL")
                            if 'weight' not in existing:
                                to_add.append("ALTER TABLE medical_records ADD COLUMN weight VARCHAR(64) DEFAULT NULL")
                            for stmt in to_add:
                                mcur.execute(stmt)
                            if to_add:
                                migr_conn.commit()
                    finally:
                        try:
                            migr_conn.close()
                        except Exception:
                            pass
                    try:
                        migr_conn.close()
                    except Exception:
                        pass
                    # Retry insert on a fresh connection
                    conn = get_conn()
                    record_id = do_insert(conn)
                except Exception as e2:
                    raise e2
            else:
                raise
    except Exception as e:
        # log full traceback to server logs for debugging; return minimal error to client
        tb = traceback.format_exc()
        # Persist traceback to disk for later inspection
        try:
            logdir = os.path.join(current_app.root_path, 'logs')
            os.makedirs(logdir, exist_ok=True)
            with open(os.path.join(logdir, 'upload_errors.log'), 'a', encoding='utf-8') as lf:
                lf.write(f"---\n{tb}\n")
        except Exception:
            pass
        try:
            current_app.logger.error("DB insert failed: %s", tb)
        except Exception:
            pass
        return jsonify({"error": "DB insert failed", "detail": str(e), "trace": tb}), 500
    finally:
        try:
            if conn:
                conn.close()
        except Exception:
            pass

    # Return the local file URL so frontend can display it. Frontend may store this in image_url
    file_url = f"/uploads/{tmp_name}"
    # Return the parsed fields (merged) so frontend can present them to user
    out_fields = {
        'patient_name': patient_name,
        'raw_text': raw_text,
        'diagnosis': diagnosis,
        'medications': medications,
        'age': age,
        'sex': sex,
        'blood_pressure': blood_pressure,
        'weight': weight,
    }
    return jsonify({"success": True, "record_id": record_id, "fields": out_fields, "url": file_url})
