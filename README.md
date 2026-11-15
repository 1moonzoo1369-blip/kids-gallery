# 우리 아이 그림앨범

아이 그림 사진을 올리면 날짜별 전시실로 보여주는 웹앱이에요. 서버 없이 **GitHub 레포 + GitHub Pages** 만으로 동작해요.

- 열람: 사이트 주소만 알면 누구나 (로그인 없음)
- 업로드·수정·삭제: 오른쪽 위 자물쇠 → **가족 업로드 비밀번호** 입력 (기기마다 한 번)
- 장식 이미지(액자·조명·선반 등)는 GPT 이미지 생성으로 만들었어요 (`assets/`)

## 저장 구조

```
drawings/<아이폴더>/<년>/<월>/<날짜>_<번호>.jpg   ← 원본(긴 변 2000px)
thumbs/<아이폴더>/<년>/<월>/<날짜>_<번호>.jpg     ← 갤러리용 작은 그림
profiles/<아이폴더>_<시각>.jpg                     ← 시작 화면 아이 사진 (바꾸면 예전 것은 지워짐)
data.json                                          ← 아이 목록, 제목·내용
```

예: `drawings/seoyun/2026/01/2026-01-14_01.jpg`, 같은 날 두 번째는 `_02`.

## 날짜별로 한 번에 내려받기

- **전체**: GitHub 레포 화면 → 초록색 `Code` → `Download ZIP` → 압축 풀고 `drawings/` 폴더
- **한 아이 / 한 달만**: 레포에서 `drawings/seoyun/2026/01` 폴더를 연 뒤, 그 폴더 주소 전체를 `https://download-directory.github.io/?url=` 뒤에 붙여 열면 그 폴더만 ZIP으로 받아져요.
- **PC에서 계속 동기화**: `git clone https://github.com/<아이디>/<레포>.git` 후 가끔 `git pull`

파일 이름이 날짜라서 어떤 폴더 보기에서든 이름순 정렬 = 날짜순이에요.

## 처음 설정 (한 번만)

1. GitHub에서 **Public** 레포를 만들고 이 폴더 내용을 올린다.
2. 레포 Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `/(root)` → Save
3. Settings(내 계정) → Developer settings → Fine-grained tokens → 새 토큰
   - Repository access: 이 레포만 / Permissions: **Contents: Read and write**
4. `https://<아이디>.github.io/<레포>/setup.html` 접속 → 토큰과 가족 비밀번호 입력 → 저장
5. 사이트에서 자물쇠가 풀린 상태로 `아이 추가` → 그림 올리기

토큰이 만료되면 4번만 다시 하면 돼요. 남편분 기기에서는 자물쇠 → 비밀번호만 입력.

## 로컬 미리보기

```
python -m http.server 5173
```
`http://localhost:5173/?demo` 로 열면 예시 그림으로 화면을 볼 수 있어요 (`demo/` 폴더는 GitHub에 올라가지 않아요).
