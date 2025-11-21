# target_server_fastapi.py
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
PORT = 5000
ATTACKER_URL = "http://127.0.0.1:8080"

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",    # LMS 웹
        "http://127.0.0.1:8080",   # 동일주소 (브라우저가 localhost/127 혼용 시)
        "http://127.0.0.1:8000",   # 혹시 8000에서 LMS를 띄웠다면
    ],
    allow_credentials=True,
    allow_methods=["*"],            # GET, POST, OPTIONS 전부 허용
    allow_headers=["*"],
)

@app.get("/login")
async def login():
    html = """
    <h3>[목표 서버] 로그인 완료. 세션 쿠키 설정됨.</h3>
    <p>이제 <a href='http://localhost:8000/survey.html'>http://localhost:8000/survey.html</a> 로 이동해 보세요.</p>
    """
    response = HTMLResponse(content=html)
    response.set_cookie("session_id", "student_2025_kyu", samesite="lax")
    return response

@app.post("/pay_now")
async def pay_now(request: Request, product_id: str = Form(...), amount: str = Form(...)):
    session = request.cookies.get("session_id", "세션 없음")
    print("\n===========================================================")
    print("🎉 CSRF 공격 성공! 비인가 결제 요청 수신됨!")
    print(f"   - 세션 ID: {session}")
    print(f"   - 결제 상품 ID: {product_id}")
    print(f"   - 결제 금액: {amount}원")
    print("===========================================================\n")
    return RedirectResponse(url=f"http://127.0.0.1:{PORT}/payment_success.html", status_code=303)

@app.get("/payment_success.html", response_class=HTMLResponse)
async def success_page():
    with open("payment_success.html", "r", encoding="utf-8") as f:
        return f.read()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("target_server:app", host="127.0.0.1", port=5000, reload=True)