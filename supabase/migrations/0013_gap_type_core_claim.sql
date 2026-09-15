-- 0013 — 빈틈이 없어도 질문은 하나 낸다: gap_type 'core_claim'
-- github issue #14 (결정 2026-09-15, 김민경), PR #26 (ai · pickCoreClaim)
--
-- 빈틈 분석이 0개를 돌려주면 지금은 독후감을 초고로 되돌리고 "한 줄만 더" 를 요구한다
-- (PR #21). 실측에서 잘 쓴 글 5건 중 4건이 빈틈 0개라 드문 경우가 아니고, 대필일수록
-- 빈틈이 없어 검증을 피한다. 빈틈이 없으면 AI 가 독후감의 핵심 주장 한 문장을 골라
-- review_gaps 행으로 저장하고, 그 뒤는 기존 흐름(질문 → 채점 → 재시도)을 그대로 탄다.
-- verifications.gap_id not null 도 그대로다 — 스키마는 이 값 하나만 는다.
--
-- 'core_claim' 은 빈틈이 아니다. 화면은 "이번엔 빈틈이 없었어! 그래도 하나만 물어볼게" 로
-- 보여준다 (verification · 박재경). 채점 기준은 같다.

alter type gap_type add value if not exists 'core_claim';
