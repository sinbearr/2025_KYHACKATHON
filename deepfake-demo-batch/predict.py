
import torch
import torch.nn as nn
from torchvision import transforms
from PIL import Image
import numpy as np
import mediapipe as mp

_mp_face = mp.solutions.face_detection
FACE_DET_CONF = 0.5
FACE_MARGIN   = 0.20
TARGET_SIZE   = (224, 224)

def _pil_to_rgb_np(pil_img: Image.Image) -> np.ndarray:
    return np.array(pil_img.convert("RGB"))

def _crop_face_with_margin(pil_img: Image.Image, det) -> Image.Image:
    w, h = pil_img.size
    rel = det.location_data.relative_bounding_box
    x, y, bw, bh = rel.xmin, rel.ymin, rel.width, rel.height
    x1 = int(max(0, (x - FACE_MARGIN) * w))
    y1 = int(max(0, (y - FACE_MARGIN) * h))
    x2 = int(min(w, (x + bw + FACE_MARGIN) * w))
    y2 = int(min(h, (y + bh + FACE_MARGIN) * h))
    if x2 <= x1 or y2 <= y1:
        return pil_img
    return pil_img.crop((x1, y1, x2, y2))

def load_model(model_path: str = "deepfake_detector_best.pth"):
    import torchvision.models as models
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    model = models.efficientnet_b0(weights=None)
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_ftrs, 1)

    state = torch.load(model_path, map_location=device)
    model.load_state_dict(state)
    model.to(device).eval()

    preprocess = transforms.Compose([
        transforms.Resize(TARGET_SIZE),
        transforms.ToTensor(),
        transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
    ])

    face_detector = _mp_face.FaceDetection(model_selection=0, min_detection_confidence=FACE_DET_CONF)

    return {
        'model': model,
        'device': device,
        'preprocess': preprocess,
        'face_detector': face_detector
    }

def _detect_main_face(helper, pil_img: Image.Image):
    img_np = _pil_to_rgb_np(pil_img)
    res = helper['face_detector'].process(img_np)
    if not res or not res.detections:
        return None
    def area(det):
        bb = det.location_data.relative_bounding_box
        return max(0.0, bb.width) * max(0.0, bb.height)
    return max(res.detections, key=area)

def _prepare_tensor(helper, pil_img: Image.Image) -> torch.Tensor:
    det = _detect_main_face(helper, pil_img)
    roi = _crop_face_with_margin(pil_img, det) if det else pil_img
    return helper['preprocess'](roi)

def infer_one(helper, pil_image: Image.Image) -> float:
    model = helper['model']
    device = helper['device']
    x = _prepare_tensor(helper, pil_image).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = model(x).squeeze(1)
        prob = torch.sigmoid(logits).item()
    return prob

def infer_batch(helper, pil_images: list) -> list:
    device = helper['device']
    tensors = [_prepare_tensor(helper, im) for im in pil_images]
    xs = torch.stack(tensors).to(device)
    with torch.no_grad():
        logits = helper['model'](xs).squeeze(1)
        probs = torch.sigmoid(logits).cpu().tolist()
    return probs
