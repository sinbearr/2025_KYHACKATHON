
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
import io, base64, os
import predict

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

app.mount("/static", StaticFiles(directory="."), name="static")
NO_CACHE = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

@app.get("/")
@app.get("/index.html")
def read_index():
    return FileResponse("index.html", media_type="text/html", headers=NO_CACHE)

@app.get("/demo.mp4")
def read_demo():
    return FileResponse("demo.mp4", media_type="video/mp4", headers=NO_CACHE)

@app.get("/_stat")
def stat_file():
    st = os.stat("demo.mp4")
    return {"size": st.st_size, "mtime": st.st_mtime}

model_helper = predict.load_model(model_path="deepfake_detector_best.pth")

@app.post("/predict_frame")
async def predict_frame(req: Request):
    data = await req.body()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    p = predict.infer_one(model_helper, img)
    return {"fake_prob": round(float(p), 4), "decision": "FAKE" if p>0.5 else "REAL"}

@app.post("/predict_frames")
async def predict_frames(req: Request):
    data = await req.json()
    frames = data.get("frames", [])
    pil_images = []
    for b64 in frames:
        try:
            imgdata = base64.b64decode(b64)
            pil_images.append(Image.open(io.BytesIO(imgdata)).convert("RGB"))
        except Exception:
            continue
    if not pil_images:
        return {"frames": 0, "decision": "UNKNOWN"}
    probs = predict.infer_batch(model_helper, pil_images)
    avg_fake = sum(probs)/len(probs)
    decision = "FAKE" if avg_fake > 0.5 else "REAL"
    return {
        "frames": len(probs),
        "fake_prob_avg": round(avg_fake, 4),
        "fake_prob_max": round(max(probs), 4),
        "decision": decision
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
