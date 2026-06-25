# 밥심 식사배달관리

공장/사무실 식사 배달용 PWA MVP입니다.

## 실행

```bash
npm install
npm run dev
```

로컬 주소:

- 메인: http://127.0.0.1:3000
- 관리자: http://127.0.0.1:3000/admin
- 거래처 담당자: http://127.0.0.1:3000/client

HTTPS 테스트 배포:

- https://bapsim-meal-delivery.workspace-398477.chatgpt-team.site

## 샘플 로그인

- 관리자: 전화번호 입력 후 인증번호 4자리 이상 입력
- 거래처 담당자: PIN `1234`

## 현재 구현

- PWA 기본 설정
- 밥심 로고 반영
- 관리자 오늘 현황, 중요 변경, 거래처 관리, 배달표, 월별 집계
- 거래처 등록/수정/일시중지/PIN 재발급
- 고객 수량 변경, 식사 거절, 업체 정보 변경 요청
- 로컬 저장소 기반 샘플 데이터
- CSV 다운로드
- Supabase 스키마 초안

## Supabase 연결 준비

- `.env.example`을 복사해 `.env.local` 생성
- `docs/supabase-schema.sql`을 Supabase SQL Editor에서 실행
- `docs/supabase-setup.md` 참고

환경변수가 없으면 앱은 자동으로 로컬 저장 모드로 실행됩니다.
환경변수가 있으면 `/api/state`를 통해 Supabase에서 상태를 읽고 저장합니다.

## 개발자 인수인계

다음 작업자는 `docs/developer-notes.md`를 먼저 확인하세요.
