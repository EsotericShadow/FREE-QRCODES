# api/qrcode.py
from flask import Flask, request, jsonify
import qrcode
from PIL import Image
import io, base64

app = Flask(__name__)

@app.route("/api/qrcode", methods=["POST"])
def gen_qr():
    data = request.get_json()
    url = data.get("url", "")
    fill = data.get("fillColor", "#000000")
    back = data.get("backColor", "#FFFFFF")
    logo_data = data.get("logo")  # something like "data:image/png;base64,...."

    # 1) generate base QR
    qr = qrcode.QRCode(
        version=4,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fill, back_color=back).convert("RGB")

    # 2) if there's a logo, decode & paste
    if logo_data:
        header, b64 = logo_data.split(",", 1)
        logo_bytes = base64.b64decode(b64)
        logo = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")

        # scale logo to 25% of QR width
        w, h = img.size
        logo_size = int(w * 0.25)
        logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
        pos = ((w - logo_size) // 2, (h - logo_size) // 2)
        img.paste(logo, pos, logo)

    # 3) send back as base64 data URL
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode()
    return jsonify({"image": f"data:image/png;base64,{encoded}"})

# expose the WSGI app as `app`
