 # 🧠 Deepfake Detection Demo (LMS + Chrome Extension)

> 건양대학교 스마트보안학과 | 2025 학술제 시연용
>
> 본 프로젝트는 딥페이크 탐지모델을 LMS 웹 환경 및 크롬 확장프로그램으로 통합한 시연용 데모입니다.  
> CSRF 공격 시나리오와 Deepfake Guard 확장프로그램을 통해 공격/대응 과정을 단계적으로 보여줍니다.


** 탐지모델
- EfficientNet-B0 기반 모델 사용
---

## 📁 프로젝트 구조


📦 KYHACKATHON_PROJECT_DF
│
├─ target_server/                # 공격 대상 서버 (CSRF 취약)
│   ├─ target_server.py          # FastAPI 서버
│   ├─ payment_success.html      # 결제 완료 페이지
│   └─ ...
│
├─ LMS_WEB/                      # LMS 학습 사이트 (공격자 웹)
│   ├─ index.html                # 동영상 시청
│   ├─ post.html                 # 게시판
│   ├─ survey.html               # CSRF 트리거 설문조사
│   └─ styles.css
│
├─ deepfake-demo-batch/          # 딥페이크 탐지 데모 서버
│   ├─ app.py                    # FastAPI 서버
│   ├─ predict.py                # 추론 로직
│   ├─ deepfake_detector_best.pth # 학습된 탐지 모델
│   ├─ demo.mp4                  # 테스트 영상 (초상권 문제로 삭제함)
│   ├─ index.html                # 테스트 페이지
│   │
│   └─ extension/                # 크롬 확장프로그램
│       ├─ manifest.json
│       ├─ background.js
│       ├─ content.js
│       ├─ overlay.css
│       ├─ popup.html
│       ├─ popup.js
│       └─ icons/
│
└─ ...


## 🚀 1. 서버 실행 방법

1. 탐지서버(모델) port -> 8000
cd /KYHACKATHON_PROJECT_DF/deepfake_demo_batch
python app.py

2. CSRF서버 port -> 5000
cd /KYHACKATHON_PROJECT_DF/target_server
python target_server.py

3. LMS 서버 -> port -> 8080
cd /KYHACKATHON_PROJECT_DF/LMS_WEB
python -m http.server 8080

🧩 2. 크롬 확장프로그램 등록
🔹 (1) Chrome 확장프로그램 메뉴 진입

1. Chrome 주소창에 chrome://extensions/ 입력

2. 오른쪽 상단 "개발자 모드" 켜기

3. "압축해제된 확장 프로그램 로드" 클릭

🔹 (2) 확장 프로그램 로드

- extension 폴더 선택
    (📂 manifest.json 파일이 포함된 폴더)

🔹 (3) 정상 등록 확인

- 툴바에 🔍 Deepfake Guard 아이콘이 생김

- demo.mp4 재생 시 영상 좌측 상단에 분석 대기 배지 표시

- 딥페이크 확률이 높을 경우 ⚠️ 경고 팝업이 뜨며 알림이 표시됨