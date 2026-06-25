# 밥심 식사배달관리 MVP 기획 요약

## 방향

- 거래처 담당자 1명이 해당 업체의 식사 수량 변경 또는 식사 거절을 입력한다.
- 평소에는 요일별/식사별 기본 수량이 자동 적용되고, 예외가 있을 때만 변경한다.
- 변경 마감은 당일 오전 10시다.
- 초기 배포는 PWA 설치형 웹앱으로 한다.
- 관리자는 PC와 휴대폰에서 오늘 현황, 중요 변경, 배달표, 월별 집계를 확인한다.

## MVP 포함 범위

- 고객: QR/초대 링크 + 4자리 PIN, 오늘 식수 확인, 수량 변경, 식사 거절, 마감 후 변경 요청, 변경 내역, 업체 정보 변경 요청.
- 관리자: 전화번호 인증 로그인, 오늘 현황, 중요 변경 확인, 거래처 관리, 배달표, 엑셀 호환 CSV 다운로드, 월별 집계, 휴무일/설정 뼈대.
- 알림: 1차 코드는 PWA/브라우저 알림 권한 UI와 알림 기록 구조를 둔다. 실제 원격 푸시는 서버 연동 단계에서 붙인다.

## 기술 결정

- Frontend/App: Next.js + TypeScript + Tailwind CSS
- Distribution: PWA
- Database target: Supabase PostgreSQL
- Notification target: Web Push 또는 Firebase Cloud Messaging
- Deployment target: Vercel

## 1차 구현 상태

이 프로젝트의 첫 버전은 Supabase 연결 전에도 실행되는 로컬 MVP다.
브라우저 localStorage에 샘플 거래처, 주문, 변경 요청을 저장해서 관리자와 고객 화면 흐름을 먼저 검증한다.

## 2차 구현 상태

- Supabase 연결용 패키지와 클라이언트 파일을 추가했다.
- Supabase SQL 스키마 초안을 추가했다.
- 관리자 거래처 등록, 수정, 일시중지, PIN 재발급을 localStorage 기반으로 구현했다.
- 실제 DB 연결 전에도 거래처 CRUD 흐름을 화면에서 검증할 수 있다.

## 3차 구현 상태

- Supabase 관리자 클라이언트와 `/api/state` 엔드포인트를 추가했다.
- 앱 상태를 Supabase 테이블 구조와 매핑하는 변환 계층을 추가했다.
- 환경변수가 있으면 Supabase 저장, 없으면 로컬 저장으로 자동 전환한다.
- 샘플 데이터 ID를 UUID 형식으로 맞춰 Supabase UUID 컬럼과 호환되게 했다.
