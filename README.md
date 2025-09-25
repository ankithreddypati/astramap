# astramap

![Astramap Webapp](assets/webapp.png)

Astramap is a browser-based projection mapping tool to generate and manipulate context-aware images for spatial displays. It combines a FastAPI proxy to the FAL Flux Kontext model with a React/Vite frontend that lets you project, warp (perspective transform), and preview outputs on a canvas.

## What it does
- Generates images from a prompt and an optional source image using Flux Kontext via a thin FastAPI proxy.
- Lets you place and warp images on a canvas to match physical surfaces or projector setups for projection mapping.
- Provides a simple UI to iterate fast and preview results in real time.

## How it works
1. Frontend collects a prompt and optional image, sends it to the backend.
2. Backend calls FAL Flux Kontext and returns generated image URLs and metadata.
3. Frontend displays results and uses perspective transforms to align images to your target surface.

Concise setup for frontend (Vite + React) and backend (FastAPI).

## Backend
```
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install fastapi uvicorn fal-client python-dotenv pydantic

# .env in backend/
echo "FAL_KEY=your_fal_api_key" > .env

# run
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

## Frontend
```
cd frontend
npm install


npm run dev
```

Endpoints:
- POST http://localhost:8000/generate
- POST http://localhost:8000/generate/upload

Default dev URL: http://localhost:5173


References:
https://webglfundamentals.org/webgl/lessons/webgl-planar-projection-mapping.html