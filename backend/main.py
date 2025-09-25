from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import requests
import io
import base64
from PIL import Image
import os

app = Flask(__name__)
CORS(app)

# Flux API endpoint (you'll need to replace this with your actual Flux API)
FLUX_API_URL = "https://api.example.com/flux/generate"  # Replace with actual Flux API
FLUX_API_KEY = os.getenv("FLUX_API_KEY", "your-api-key-here")

@app.route('/generate-image/', methods=['POST'])
def generate_image():
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        style = data.get('style', 'default')
        
        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        # For now, return a placeholder image
        # Replace this with actual Flux API call
        placeholder_image = create_placeholder_image(prompt, style)
        
        return send_file(
            placeholder_image,
            mimetype='image/png',
            as_attachment=False
        )
        
    except Exception as e:
        print(f"Error generating image: {e}")
        return jsonify({'error': 'Failed to generate image'}), 500

def create_placeholder_image(prompt, style):
    """Create a placeholder image with the prompt text"""
    from PIL import Image, ImageDraw, ImageFont
    
    # Create a simple placeholder image
    img = Image.new('RGB', (512, 512), color='#23242b')
    draw = ImageDraw.Draw(img)
    
    # Try to use a default font, fallback to basic if not available
    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except:
        font = ImageFont.load_default()
    
    # Split prompt into lines if too long
    words = prompt.split()
    lines = []
    current_line = ""
    
    for word in words:
        if len(current_line + " " + word) <= 30:
            current_line += " " + word if current_line else word
        else:
            lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    
    # Draw text
    y_offset = 200
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        text_width = bbox[2] - bbox[0]
        x = (512 - text_width) // 2
        draw.text((x, y_offset), line, fill='#4e8cff', font=font)
        y_offset += 30
    
    # Draw style info
    style_text = f"Style: {style}"
    bbox = draw.textbbox((0, 0), style_text, font=font)
    text_width = bbox[2] - bbox[0]
    x = (512 - text_width) // 2
    draw.text((x, y_offset + 20), style_text, fill='#ffffff', font=font)
    
    # Save to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    return img_bytes

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)