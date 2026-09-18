import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 개인정보처리방침 · 이용약관. owner: 김민경
 *
 * 문안의 원본은 docs/legal-draft.md 다 (#93). 여기는 그걸 화면에 올린 것이라
 * 내용을 고칠 때는 두 곳을 같이 고친다.
 *
 * 로그인 전에도 볼 수 있어야 한다 — 개인정보보호법 §30 게시 의무. routing.ts 의
 * PUBLIC_PREFIXES 에 /privacy, /terms 가 있다.
 *
 * 법률 문서라 서비스의 반말 톤(CLAUDE.md §9)을 쓰지 않는다. 대신 글자 크기는
 * 16px 이상으로 두고 문장을 짧게 끊는다.
 */

export const LEGAL = {
  /** 개인정보 보호책임자 */
  officer: { name: "김민경", email: "infinitelove367@gmail.com" },
  /** 시행일 = 게시일. 아래 4항의 Anthropic 약관 확인일도 이 날이다 — 그래서 개정일을 따로 둔다 */
  effectiveDate: "2026-09-16",
  /**
   * 개정일. 9/18 게임화(체크포인트·캐릭터·읽기 기록)로 처리 항목과 국외 이전 항목이 늘었다.
   * 개인정보보호법 §30 — 처리방침을 바꾸면 바뀐 내용을 공개해야 한다
   */
  revisedDate: "2026-09-18",
  /** 예선 심사 종료 · 본선 데모데이 */
  judgingEnd: "2026-10-05",
  demoDay: "2026-10-17",
} as const;

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 text-[18px] font-bold text-ink">{children}</h2>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-base leading-relaxed text-ink-soft">{children}</p>;
}

function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-ink-soft">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[15px] leading-relaxed">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="border-b border-border bg-sunken px-3 py-2 text-left font-bold text-ink"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border-b border-border-soft px-3 py-2 align-top text-ink-soft"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Contact() {
  return (
    <>
      {LEGAL.officer.name} ·{" "}
      <a href={`mailto:${LEGAL.officer.email}`} className="underline">
        {LEGAL.officer.email}
      </a>
    </>
  );
}

function Privacy() {
  return (
    <>
      <H2>1. 처리하는 항목</H2>
      <Table
        head={["구분", "항목", "어디서"]}
        rows={[
          ["필수", "이름(구글 계정 표시 이름), 이메일", "구글 로그인"],
          ["필수", "역할(학생·교사), 학년", "온보딩"],
          [
            "필수",
            "학교명·학년·반",
            "교사가 반을 만들 때 입력. 학생은 반 코드로 연결",
          ],
          ["선택", "탐험가 등급(새싹·탐험가·대장)", "온보딩"],
          [
            "이용 중 생성",
            "독후감 본문, AI 질문·답변, 채점 결과, 책갈피 적립 내역, 연속 기록, 읽은 책 목록, 책잇 서재에서 읽은 장, 체크포인트 문항·답변·판정, 캐릭터·도감, 아이템 구매 내역",
            "서비스 이용",
          ],
        ]}
      />
      <P>파일 업로드 기능은 없습니다. 주민등록번호·연락처·주소는 수집하지 않습니다.</P>

      <H2>2. 처리 목적</H2>
      <P>
        독해 이해도 검증(빈틈 분석 → 질문 → 채점), 책갈피 적립, 반 단위 순위 집계,
        교사의 학급 현황 확인, 보호자 공유 링크 제공, 읽기 진행에 따른 캐릭터·도감·표지
        퍼즐과 장 끝 체크포인트.
      </P>

      <H2>3. 보유 기간</H2>
      <P>
        대회 일정 종료 후 파기합니다 — 예선 심사 종료({LEGAL.judgingEnd}), 본선에 오르면
        데모데이({LEGAL.demoDay})까지. 이용자가 삭제를 요청하면 지체 없이 파기합니다.
        앱의 계정 삭제 기능을 쓰면 모든 데이터가 함께 삭제됩니다.
      </P>

      <H2>4. 제3자 제공과 처리 위탁</H2>
      <P>제3자 제공은 없습니다. 아래 업무를 위탁하며, 일부는 국외로 이전됩니다.</P>
      <Table
        head={["받는 자", "국가", "이전 항목", "목적", "시점·방법", "보유 기간"]}
        rows={[
          [
            "Anthropic, PBC",
            "미국",
            "독후감 본문, 학생 답변(검증·체크포인트), 학년, 책 제목·저자·줄거리, 책잇 서재 책의 본문(저작권이 만료된 원문)",
            "AI 빈틈 분석·질문 생성·채점, 체크포인트 문항 생성·판정",
            "학생이 독후감을 제출·답변할 때, 책잇 서재에서 한 장을 다 읽었을 때와 체크포인트에 답할 때 API 전송",
            "수신 후 30일 이내 자동 삭제. 이용 정책 위반으로 자동 분류되면 입력·출력 최대 2년, 판정 기록(위반 항목·확신도) 최대 7년",
          ],
          [
            "Supabase, Inc.",
            "한국 (AWS 서울 리전에 저장. 사업자는 미국 법인)",
            "위 1항 전체",
            "데이터베이스·인증",
            "서비스 이용 시",
            "위 3항과 같음",
          ],
          [
            "Vercel, Inc.",
            "미국 (서버 함수는 서울 리전에서 실행)",
            "접속 기록",
            "애플리케이션 호스팅",
            "접속 시",
            "위 3항과 같음",
          ],
        ]}
      />
      <P>
        전송한 내용은 AI 모델 학습에 사용되지 않습니다. Anthropic 상용 약관은 &ldquo;Anthropic
        may not train models on Customer Content from Services&rdquo;라고 정하고 있으며(2025-06-17
        시행), 입력·출력은 수신 후 30일 이내에 자동 삭제됩니다(Anthropic 공개 보관 정책,
        {LEGAL.effectiveDate} 확인).
      </P>

      <H2>5. 만 14세 미만 아동</H2>
      <P>
        이 서비스의 주 이용자는 만 14세 미만을 포함합니다. 학생은 교사가 발급한 반 코드로만
        가입할 수 있고, 자유 가입 경로가 없습니다. 보호자 동의는 학교가 받고 교사가 코드를
        배포하는 구조를 전제하며, 교사가 반 코드를 발급받는 화면에 &ldquo;보호자 동의를 받은
        학생에게만 이 코드를 알려주세요&rdquo;를 표시합니다.
      </P>
      <P>
        현재는 대회 심사를 위한 시연 단계이며, 법정대리인 본인확인과 동의 기록 보관을 포함한
        정식 동의 절차는 구현돼 있지 않습니다. 상용화 전 과제로 남깁니다.
      </P>

      <H2>6. 정보주체의 권리</H2>
      <P>
        열람·정정·삭제·처리정지를 요청할 수 있습니다. 만 14세 미만 아동의 권리는 법정대리인이
        대리 행사할 수 있습니다. 요청은 아래 8항의 연락처로 보내주세요. 삭제는 앱 안의 계정
        삭제 기능으로도 할 수 있습니다.
      </P>

      <H2>7. 안전성 확보조치</H2>
      <Ul
        items={[
          "모든 테이블에 행 단위 접근 제어(RLS)를 적용합니다. 학생은 자기 데이터만 읽습니다.",
          "독후감 본문은 교사와 보호자에게도 보이지 않습니다. 교사는 점수·통과 여부·완료 수만, 보호자 링크는 완료 수·책갈피·이해도 점수만 봅니다.",
          "AI API 키는 서버에서만 쓰고 브라우저에 노출하지 않습니다.",
          "파일 업로드 경로를 두지 않습니다.",
        ]}
      />

      <H2>8. 개인정보 보호책임자</H2>
      <P>
        <Contact />
      </P>

      <H2>9. 시행일</H2>
      <P>
        {LEGAL.effectiveDate} (개정 {LEGAL.revisedDate} — 체크포인트·캐릭터·읽기 기록 추가에
        따라 1·2·4항의 처리 항목과 국외 이전 항목을 늘렸습니다)
      </P>
    </>
  );
}

function Terms() {
  return (
    <>
      <H2>1. 목적</H2>
      <P>이 약관은 책잇(이하 &ldquo;서비스&rdquo;)의 이용 조건을 정합니다.</P>

      <H2>2. 가입</H2>
      <P>
        학생은 교사가 발급한 6자리 반 코드와 구글 계정으로 가입합니다. 교사는 구글 계정으로
        가입하고 반을 만듭니다. 학교·반을 자유 입력으로 받지 않습니다 — 다른 반의 자료를 볼 수
        있게 되기 때문입니다.
      </P>

      <H2>3. 서비스 내용</H2>
      <P>
        책을 고르고 독후감을 쓰면 AI가 근거가 약한 문장을 찾아 질문하고, 답변을 채점해
        책갈피를 줍니다. 책갈피는 서비스 안의 기록이며 현금 가치가 없고 환급되지 않습니다.
      </P>

      <H2>4. AI 판정의 성격</H2>
      <Ul
        items={[
          "AI는 정답 여부를 채점하지 않습니다. 독후감과 답변이 서로 맞는지(논리·구체성·문체)를 봅니다.",
          "학교 성적·평가와 무관하며, 학업 평가 자료로 쓰도록 만들어지지 않았습니다.",
          "AI가 만든 질문과 판정은 틀릴 수 있습니다. 통과하지 못해도 다시 시도할 수 있습니다.",
          "이용자는 사람이 아니라 AI와 상호작용합니다.",
        ]}
      />

      <H2>5. 이용자 의무</H2>
      <Ul
        items={[
          "다른 사람이 쓴 글을 자기 독후감으로 제출하지 않습니다.",
          "계정을 다른 사람과 공유하지 않습니다.",
          "타인을 비방하거나 개인정보를 노출하는 내용을 쓰지 않습니다.",
        ]}
      />

      <H2>6. 서비스 제공 기간</H2>
      <P>
        이 서비스는 원티드 AI 챔피언십 2026 출품작이며, 대회 일정(예선 심사 ~{LEGAL.judgingEnd},
        본선 진출 시 데모데이 {LEGAL.demoDay}) 동안 제공됩니다. 이후 중단될 수 있습니다.
      </P>

      <H2>7. 면책</H2>
      <P>
        서비스는 현재 상태로 제공됩니다. 천재지변, 외부 API(구글·국립중앙도서관·AI 사업자)
        장애 등 통제할 수 없는 사유로 인한 중단에 책임지지 않습니다.
      </P>

      <H2>8. 문의</H2>
      <P>
        <Contact />
      </P>

      <H2>9. 시행일</H2>
      <P>{LEGAL.effectiveDate}</P>
    </>
  );
}

export type LegalKind = "privacy" | "terms";

const TITLE: Record<LegalKind, string> = {
  privacy: "개인정보처리방침",
  terms: "이용약관",
};

export function LegalPage({ kind }: { kind: LegalKind }) {
  const other: LegalKind = kind === "privacy" ? "terms" : "privacy";
  return (
    <main className="min-h-dvh bg-cream px-4 py-8">
      <article className="mx-auto w-full max-w-[720px] rounded-card bg-card px-6 py-8 shadow-card">
        <h1 className="text-[26px] font-bold text-ink">{TITLE[kind]}</h1>
        <p className="mt-1.5 text-sm text-muted">책잇 (Bookit) · 시행일 {LEGAL.effectiveDate}</p>

        {kind === "privacy" ? <Privacy /> : <Terms />}

        <nav className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-border-soft pt-5 text-sm text-muted">
          <Link href={`/${other}`} className="underline">
            {TITLE[other]}
          </Link>
          <Link href="/login" className="underline">
            로그인으로
          </Link>
        </nav>
      </article>
    </main>
  );
}
