# supabase/tests

마이그레이션을 실제 Postgres 에 올려서 RLS 와 교사 뷰의 동작을 검증한다.

```
npm run test:rls
```

Docker 도 Supabase CLI 도 필요 없다. [PGlite](https://pglite.dev) 가 실물
PostgreSQL 을 WASM 으로 띄운다. `supabase/migrations/*.sql` 을 이름순으로
전부 적용하므로 마이그레이션을 추가하면 자동으로 포함된다.

## fixtures

Supabase 런타임을 흉내내는 최소 shim 이다.

| 파일 | 언제 | 내용 |
|---|---|---|
| `shim.sql` | 마이그레이션 **전** | `anon`/`authenticated`/`service_role` 역할, `auth.users`, JWT claim 을 읽는 `auth.uid()` |
| `grants.sql` | 마이그레이션 **전** | default privileges 로 public 테이블에 grant 를 연다. Supabase 기본 상태와 같고, 실제 제한은 RLS 가 한다. 마이그레이션 뒤에 `grant all` 을 하면 0009 가 걷어낸 컬럼 권한이 도로 열린다 |
| `seed.sql` | 마지막 | 교사 2명 / 반 2개 / 학생 3명 (S1,S2→C1, S3→C2) |

`grants.sql` 이 없으면 아래 테스트가 RLS 가 아니라 권한 부족으로 막혀서
**거짓 통과**가 난다. 빼지 말 것.

## 무엇을 지키는 테스트인가

CLAUDE.md §5 는 협상 대상이 아니다. 교사와 보호자는 독후감 본문
(`reviews.body`)과 답변 원문(`verifications.answer`)에 절대 닿지 않는다.
교사가 보는 점수·통과 여부는 `v_teacher_student_progress` 가 담당한다.

그 뷰는 `security_invoker = false` 다. 이유와 배경은 github issue #3 과
`0003_reviews.sql` 의 주석에 있다. 요약하면 invoker 로 바꾸려면
`verifications` 에 교사용 SELECT 정책이 필요한데, RLS 는 행 단위라 컬럼을
가리지 못하므로 그 순간 교사가 `answer` 를 읽게 된다.

definer 뷰의 접근 통제는 뷰 정의문의 `where is_teacher_of()` 하나뿐이라,
`security_barrier = true` 로 그 필터가 base scan 아래로 밀려나지 않게
고정했다. 마지막 섹션이 그게 실제로 동작하는지를 대조군과 비교해 확인한다.
