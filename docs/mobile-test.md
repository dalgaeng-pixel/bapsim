# 모바일 테스트 방법

## 같은 와이파이 화면 테스트

PC와 휴대폰이 같은 와이파이에 연결되어 있어야 한다.

현재 PC 내부 IP:

```text
192.168.0.106
```

휴대폰 브라우저에서 아래 주소를 연다.

- 메인: `http://192.168.0.106:3000`
- 관리자: `http://192.168.0.106:3000/admin`
- 거래처 담당자: `http://192.168.0.106:3000/client`

테스트 로그인:

- 관리자: 전화번호 입력 후 인증번호 4자리 이상 아무 값 입력
- 거래처 담당자: PIN `1234`

## 서버 실행 명령

휴대폰에서 접속하려면 `127.0.0.1`이 아니라 `0.0.0.0`으로 실행한다.

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

## 주의

이 방식은 모바일 화면과 기능 테스트용이다.

휴대폰 홈 화면 설치, iPhone PWA 동작, 푸시 알림까지 정확히 보려면 HTTPS 주소가 필요하다. HTTPS 테스트는 Vercel 배포 또는 임시 HTTPS 터널을 사용한다.

## HTTPS 배포 테스트

Sites 배포 URL:

```text
https://bapsim-meal-delivery.workspace-398477.chatgpt-team.site
```

현재 Sites 배포는 비공개 배포다. 휴대폰에서 접근 시 로그인 화면이 나오면, 실제 거래처 테스트 전에 사이트 접근 권한을 공개로 바꿔야 한다.

설치 테스트:

- Android Chrome: 주소 열기 -> 메뉴 -> 앱 설치 또는 홈 화면에 추가
- iPhone Safari: 주소 열기 -> 공유 -> 홈 화면에 추가

## 임시 공개 HTTPS 터널

Sites 공개 배포가 워크스페이스 정책으로 막힌 경우, localtunnel로 임시 HTTPS 주소를 만들 수 있다.

터미널 1:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

터미널 2:

```bash
npx --yes localtunnel --port 3000 --local-host 127.0.0.1
```

예시로 생성된 주소:

```text
https://fine-pears-exist.loca.lt
```

주의:

- 이 주소는 임시 주소다.
- PC가 켜져 있고 두 터미널이 실행 중일 때만 동작한다.
- 거래처 장기 테스트용 주소로 쓰면 안 된다.
- 앱 설치/모바일 화면 확인용으로만 사용한다.
