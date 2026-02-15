import os

class Config:
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}

    # CORS — comma-separated origins, or "*" to allow all
    _cors_raw = os.environ.get('CORS_ORIGINS', '').strip()
    CORS_ORIGINS = [o.strip() for o in _cors_raw.split(',') if o.strip()] if _cors_raw and _cors_raw != '*' else '*'

    FLASK_ENV = os.environ.get('FLASK_ENV', 'development')
