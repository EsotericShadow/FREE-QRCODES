from flask import Flask, request, jsonify, abort
from flask_cors import CORS
import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import (
    SquareModuleDrawer, RoundedModuleDrawer, CircleModuleDrawer,
    VerticalBarsDrawer, HorizontalBarsDrawer
)
from qrcode.image.styles.colormasks import (
    SolidFillColorMask, RadialGradiantColorMask, SquareGradiantColorMask,
    HorizontalGradiantColorMask, VerticalGradiantColorMask
)
from PIL import Image, UnidentifiedImageError
import io, base64
import logging

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.DEBUG)

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        try:
            return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        except ValueError:
            logging.warning(f"Invalid hex color: {hex_color}")
            return (0, 0, 0)
    elif len(hex_color) == 3:
        try:
            return tuple(int(hex_color[i]*2, 16) for i in (0, 1, 2))
        except ValueError:
            logging.warning(f"Invalid hex color: {hex_color}")
            return (0, 0, 0)
    else:
        logging.warning(f"Invalid hex color length: {hex_color}")
        return (0, 0, 0)

@app.route("/api/qrcode", methods=["POST"])
def gen_qr():
    try:
        logging.debug("Received request")
        data = request.get_json()
        if not data:
            abort(400, description="Invalid JSON payload")
        logging.debug(f"Payload: {data}")

        url = data.get("url", "")
        if not url:
            abort(400, description="URL parameter is required")
        logging.debug(f"URL: {url}")

        module_shape = data.get("moduleShape", "square")
        color_mode = data.get("colorMode", "solid")
        back_color_hex = data.get("backColor", "#FFFFFF")
        logo_data = data.get("logo")
        logging.debug("Parameters parsed")

        back_color_rgb = hex_to_rgb(back_color_hex)
        logging.debug("Background color converted")

        if module_shape == "rounded":
            module_drawer = RoundedModuleDrawer()
        elif module_shape == "circle":
            module_drawer = CircleModuleDrawer()
        elif module_shape == "vertical":
            module_drawer = VerticalBarsDrawer()
        elif module_shape == "horizontal":
            module_drawer = HorizontalBarsDrawer()
        else:
            module_drawer = SquareModuleDrawer()
        logging.debug(f"Module drawer set: {module_shape}")

        if color_mode == "gradient":
            gradient_type = data.get("gradientType", "radial")
            grad_color1_hex = data.get("gradientColor1", "#000000")
            grad_color2_hex = data.get("gradientColor2", "#FFFFFF")
            grad_color1_rgb = hex_to_rgb(grad_color1_hex)
            grad_color2_rgb = hex_to_rgb(grad_color2_hex)
            logging.debug(f"Gradient colors: {grad_color1_hex}, {grad_color2_hex}")

            if gradient_type == "radial":
                color_mask = RadialGradiantColorMask(back_color=back_color_rgb, center_color=grad_color1_rgb, edge_color=grad_color2_rgb)
            elif gradient_type == "square":
                color_mask = SquareGradiantColorMask(back_color=back_color_rgb, center_color=grad_color1_rgb, edge_color=grad_color2_rgb)
            elif gradient_type == "horizontal":
                color_mask = HorizontalGradiantColorMask(back_color=back_color_rgb, left_color=grad_color1_rgb, right_color=grad_color2_rgb)
            elif gradient_type == "vertical":
                color_mask = VerticalGradiantColorMask(back_color=back_color_rgb, top_color=grad_color1_rgb, bottom_color=grad_color2_rgb)
            else:
                color_mask = RadialGradiantColorMask(back_color=back_color_rgb, center_color=grad_color1_rgb, edge_color=grad_color2_rgb)
            logging.debug(f"Gradient type: {gradient_type}")
        else:
            fill_color_hex = data.get("fillColor", "#000000")
            fill_color_rgb = hex_to_rgb(fill_color_hex)
            color_mask = SolidFillColorMask(back_color=back_color_rgb, front_color=fill_color_rgb)
            logging.debug(f"Solid fill color: {fill_color_hex}")

        logging.debug("Starting QR code generation")
        qr = qrcode.QRCode(
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4
        )
        qr.add_data(url)
        qr.make(fit=True)
        logging.debug("QR code data added and fitted")

        img = qr.make_image(
            image_factory=StyledPilImage,
            module_drawer=module_drawer,
            color_mask=color_mask
        ).convert("RGB")
        logging.debug("QR image generated")

        if logo_data and isinstance(logo_data, str) and logo_data.startswith("data:image"):
            try:
                logging.debug("Processing logo")
                header, b64 = logo_data.split(",", 1)
                logo_bytes = base64.b64decode(b64)
                logo = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
                logging.debug("Logo image opened")

                w, h = img.size
                logo_size = int(w * 0.25)
                resample_method = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.ANTIALIAS
                logo = logo.resize((logo_size, logo_size), resample_method)
                logging.debug("Logo resized")

                pos = ((w - logo_size) // 2, (h - logo_size) // 2)
                img.paste(logo, pos, logo)
                logging.debug("Logo pasted onto QR code")
            except (ValueError, base64.binascii.Error, UnidentifiedImageError) as e:
                logging.warning(f"Logo processing error: {e}")
            except Exception as e:
                logging.error(f"Unexpected error in logo processing: {e}")
        else:
            logging.debug("No logo or invalid logo data")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        encoded = base64.b64encode(buf.getvalue()).decode()
        logging.debug("Image encoded")
        return jsonify({"image": f"data:image/png;base64,{encoded}"})

    except Exception as e:
        logging.error(f"Error generating QR code: {e}")
        return jsonify({"error": "An unexpected error occurred while generating the QR code."}), 500

@app.errorhandler(400)
def handle_bad_request(e):
    response = e.get_response()
    response.data = jsonify({"error": e.description}).data
    response.content_type = "application/json"
    return response
