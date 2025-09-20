import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from flask import request

load_dotenv()

def create_app():
    app = Flask(__name__)
    # Parse allowed origins from env (comma-separated).
    # For local dev: if ALLOWED_ORIGINS is not set, default to the frontend origin so browsers receive CORS headers.
    raw = os.getenv("ALLOWED_ORIGINS")
    if not raw or raw.strip() == '':
        # Default to the local frontend origin for development convenience. If you prefer the previous
        # wildcard behaviour, set ALLOWED_ORIGINS='*' explicitly in your environment.
        print("ALLOWED_ORIGINS not set - defaulting to 'http://localhost:8080' for local development")
        raw = "http://localhost:8080"

    # If wildcard is explicitly used, we must NOT set supports_credentials=True (browsers will reject wildcard with credentials)
    if raw.strip() == '*':
        # Allow all origins for API and uploads when explicitly configured
        CORS(app, resources={r"/api/*": {"origins": "*"}, r"/uploads/*": {"origins": "*"}}, supports_credentials=False)
    else:
        origins = [o.strip() for o in raw.split(',') if o.strip()]
        # Use explicit origins and enable credentials if specific origins are provided
        CORS(app, resources={r"/api/*": {"origins": origins}, r"/uploads/*": {"origins": origins}}, supports_credentials=True)

    app.config["SECRET_KEY"] = "doncoleone"
    app.config['UPLOAD_FOLDER'] = os.getenv("UPLOAD_FOLDER", "./uploads")
    app.config['MAX_CONTENT_LENGTH'] = int(os.getenv("MAX_CONTENT_LENGTH", 15 * 1024 * 1024))

    # ensure uploads folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # blueprints
    from auth import auth_bp
    from records import records_bp
    from doctors import doctors_bp
    from upload import upload_bp
    from audit_logs import audit_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(records_bp, url_prefix="/api/medical-records")
    app.register_blueprint(doctors_bp, url_prefix="/api/doctors")
    app.register_blueprint(upload_bp, url_prefix="/api")
    app.register_blueprint(audit_bp, url_prefix="/api/audit-logs")

    # Lightweight request logging to help debug CORS / Authorization issues in local development.
    @app.before_request
    def _debug_log_request():
        try:
            origin = request.headers.get('Origin')
            auth_present = 'yes' if request.headers.get('Authorization') else 'no'
            print(f"[request] {request.method} {request.path} Origin={origin} Authorization={auth_present}")
        except Exception:
            # Never let logging break the request flow
            pass

    # Ensure an admin user exists (username 'admin'). If not, create one with default password.
    try:
        from db import get_conn
        from utils import hash_password
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username=%s", ("admin",))
            if not cur.fetchone():
                pw = hash_password(os.getenv('ADMIN_PASSWORD', 'admin256'))
                cur.execute("INSERT INTO users (username, name, password_hash, role) VALUES (%s,%s,%s,%s)",
                            ("admin", "Administrator", pw, 'admin'))
                conn.commit()
    except Exception:
        # Do not prevent app from starting; admin creation is best-effort
        try:
            conn.close()
        except Exception:
            pass

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"})

    @app.route("/api/db-health", methods=["GET"])
    def db_health():
        try:
            from db import get_conn
            conn = get_conn()
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                _ = cur.fetchone()
            conn.close()
            return jsonify({"db": "ok"})
        except Exception as e:
            try:
                import traceback
                tb = traceback.format_exc()
            except Exception:
                tb = str(e)
            return jsonify({"db": "error", "detail": str(e), "trace": tb}), 500

    # Serve uploaded files
    from flask import send_from_directory

    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        resp = send_from_directory(app.config['UPLOAD_FOLDER'], filename)
        # Allow moderate caching but avoid aggressive stale behavior during development
        resp.headers['Cache-Control'] = 'public, max-age=60'
        # Ensure the uploaded file can be fetched from the frontend (allow CORS for images)
        # For local development we allow any origin; in production restrict this header accordingly.
        if 'Access-Control-Allow-Origin' not in resp.headers:
            resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp

    return app

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3001))
    app = create_app()
    app.run(host="0.0.0.0", port=port, debug=True)
    
