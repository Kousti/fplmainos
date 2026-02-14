"""
Flask server: serves the FPL app.
Run: python server.py   then open http://localhost:5000
"""
import os

from flask import Flask, send_from_directory

app = Flask(__name__, static_folder=".", static_url_path="")


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"FPL app: http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
