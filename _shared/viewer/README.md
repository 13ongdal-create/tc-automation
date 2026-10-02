# 공용 TC 뷰어 템플릿

`viewer.template.html`은 **프로젝트 콘텐츠가 없는** 공용 템플릿이고, `render-viewer.js`가 프로젝트 데이터(JSON)만 주입해 뷰어 HTML을 만듭니다.
AGENTS.md 10항 참조. AI는 뷰어 HTML/CSS/JS를 직접 작성하지 않고 아래 명령으로만 생성합니다.

```
node _shared/viewer/render-viewer.js "project/{프로젝트명}" {모듈코드} "project/{프로젝트명}/TC/{프로젝트명}_TC_{모듈코드}.html" [--extra "project/{프로젝트명}/TC/viewer-extra-modals.json"]
```

- 입력: `TC/{프로젝트}_TC_{모듈}.json`(meta+items), `TC/defects.json`, `project.json`(url), (선택) `TC/viewer-extra-modals.json`
- `viewer-extra-modals.json`: `[{ "id": "accModal", "label": "👤 테스트 계정 매트릭스", "title": "...", "html": "<table>...</table>" }]` — 비밀번호 금지(AGENTS.md 12항)
- 주입 시 `<` 를 `\u003c` 로 이스케이프합니다(AGENTS.md 10항: 스크립트 블록 조기 종료/실행 방지).
- **고정 헤더 규칙(변경 금지)**: `.table-wrap{max-height:70vh;overflow:auto}` + `table.tc th{position:sticky;top:0}`. `overflow:hidden`이나 `top:var(--hh)` 방식은 헤더가 첫 행과 겹칩니다.
- 템플릿 변경은 사용자가 요청·승인한 경우에만 하고, 변경 후에는 각 프로젝트 뷰어를 같은 명령으로 재생성합니다(이전 HTML은 `TC/legacy/`에 보관).
- 현재 범위: 모듈 단위 뷰어. 통합(Full) 뷰어 템플릿은 아직 없습니다.

## 필수 산출물 3종 (AGENTS.md 13항)

| 산출물 | 뷰어에서 | 데이터 위치 |
|---|---|---|
| PRD | `📄 PRD (사이트분석 & TC계획)` 버튼 (파일이 있으면 자동 노출) | `Analysis\{프로젝트명}_PRD.html` |
| 테스트 계정 매트릭스 | `👤 테스트 계정 매트릭스` 버튼 (항상 노출, 비밀번호 제외) | `TC\testAccounts.json` / 없으면 `project.json`에 `hasTestAccounts:false` + `scope`(사유) |
| User Flow Map | `🧭 User Flow Map` 버튼 | `TC\viewer-extra-modals.json` 의 `id:"flowMapModal"` 항목 |

`viewer-extra-modals.json` 예시:

```json
[
  {
    "id": "flowMapModal",
    "label": "🧭 User Flow Map",
    "title": "User Flow Map (헤더 검색 기준)",
    "html": "<table><thead><tr><th>단계</th><th>내용</th><th>확인 상태</th></tr></thead><tbody><tr><td>1. 검색창 포커스</td><td>최근/인기 검색어 레이어 노출</td><td>Playwright 관측 확인 (TC_PD_002)</td></tr></tbody></table>"
  }
]
```

- `--strict` 로 생성하면 세 항목 중 하나라도 없을 때 뷰어를 만들지 않고 누락 항목을 출력합니다(종료 코드 2). 옵션 없이 생성하면 뷰어 상단에 빨간 경고가 표시됩니다.
