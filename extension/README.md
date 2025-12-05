# EchoBreaker Chrome Extension

YouTube 에코 챔버를 분석하고 균형 잡힌 콘텐츠를 추천받는 Chrome 확장 프로그램입니다.

## 설치 방법 (개발자 모드)

### 1. 확장 프로그램 다운로드

이 `extension` 폴더를 로컬 컴퓨터에 다운로드합니다.

**방법 A: Git Clone**
```bash
git clone [repository-url]
cd [repository]/extension
```

**방법 B: 파일 직접 다운로드**
- `manifest.json`
- `content.js`
- `background.js`
- `popup.html`
- `popup.js`

위 파일들을 하나의 폴더에 저장합니다.

### 2. Chrome에 설치

1. Chrome 브라우저를 열고 주소창에 입력:
   ```
   chrome://extensions
   ```

2. 오른쪽 상단의 **"개발자 모드"** (Developer mode) 토글을 켭니다.

3. **"압축해제된 확장 프로그램을 로드합니다"** (Load unpacked) 버튼을 클릭합니다.

4. `extension` 폴더를 선택합니다.

5. EchoBreaker 확장 프로그램이 목록에 나타납니다!

### 3. 대시보드 연결 설정

1. Chrome 도구 모음에서 EchoBreaker 아이콘을 클릭합니다.

2. **Settings** 탭으로 이동합니다.

3. Dashboard URL에 Replit 앱 URL을 입력합니다:
   ```
   https://046806e2-7cc7-45a7-8712-1a53ec91f00f-00-1k55bkxju0p0w.picard.replit.dev
   ```

4. **Test Connection** 버튼을 클릭하여 연결을 확인합니다.

5. **Save Settings**를 클릭합니다.

## 사용 방법

### 자동 데이터 수집
- YouTube를 탐색하면 자동으로 시청 데이터가 수집됩니다.
- 홈페이지, 구독 피드, 시청 기록, 동영상 시청 페이지에서 데이터를 수집합니다.

### 수동 동기화
- 팝업에서 **Sync Now** 버튼을 클릭하면 즉시 데이터를 동기화합니다.

### 대시보드 열기
- **Open Dashboard** 버튼을 클릭하면 분석 대시보드가 열립니다.

## 수집되는 데이터

- 시청한 동영상 제목 및 채널
- YouTube 추천 동영상
- 구독 채널 목록

**개인정보 보호**: 모든 데이터는 사용자가 지정한 서버에만 전송됩니다.

## 문제 해결

### "Failed to fetch" 오류
- Dashboard URL이 올바른지 확인하세요.
- Replit 앱이 실행 중인지 확인하세요.
- CORS 설정이 올바른지 확인하세요.

### 데이터가 수집되지 않음
- YouTube 페이지를 새로고침하세요.
- 확장 프로그램을 다시 로드하세요 (chrome://extensions에서 새로고침 버튼 클릭).

### 연결 실패
- 인터넷 연결을 확인하세요.
- Replit 앱이 실행 중인지 확인하세요.
- 방화벽이 연결을 차단하고 있지 않은지 확인하세요.

## 개발

### 파일 구조
```
extension/
├── manifest.json     # 확장 프로그램 설정
├── content.js        # YouTube 페이지 데이터 수집
├── background.js     # 백그라운드 서비스 워커
├── popup.html        # 팝업 UI
├── popup.js          # 팝업 로직
└── README.md         # 이 파일
```

### 디버깅
1. chrome://extensions에서 "Service Worker" 링크를 클릭하여 백그라운드 콘솔을 엽니다.
2. YouTube 페이지에서 F12를 눌러 개발자 도구를 열고 콘솔에서 "[EchoBreaker]" 로그를 확인합니다.
