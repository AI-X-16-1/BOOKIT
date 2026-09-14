/**
 * 채점 기준 잡기용 독후감 20건 — docs/prompts.md "Test set (day 2)". owner: 강민구
 *
 * 네 무리로 5건씩 나눴다.
 *   well_written    잘 쓴 것           → 빈틈 0~1개, 통과해야 한다
 *   vague_but_read  뭉뚱그렸지만 읽음   → 질문이 나가고, 제대로 답하면 통과
 *   not_read        안 읽은 것         → 미통과해야 한다
 *   ghostwritten    대필·AI 생성       → style_consistency 가 shifted 로 걸려야 한다
 *
 * 판정 기준(docs/prompts.md 마지막 절):
 * "진짜 읽었지만 뭉뚱그린" 무리가 2건 넘게 실패하면 임계값이 너무 빡빡하다.
 * 심사위원이 데모하다 튕기면 서비스 전체가 고장난 것처럼 보인다.
 *
 * 맞춤법·띄어쓰기를 일부러 다듬지 않았다. 실제 초등학생 글에 가까워야
 * 채점기가 맞춤법을 감점하지 않는지도 함께 확인된다.
 */
import type { BookContext, GradeLevel } from "@/shared/types";

export type TestCategory =
  | "well_written"
  | "vague_but_read"
  | "not_read"
  | "ghostwritten";

export interface TestAnswer {
  label: string;
  text: string;
  /** 통과해야 하는 답변인가 */
  expectPass: boolean;
}

export interface TestReview {
  id: string;
  category: TestCategory;
  gradeLevel: GradeLevel;
  book: BookContext;
  body: string;
  /** 기대 빈틈 개수 범위 [최소, 최대] */
  expectGaps: [number, number];
  note?: string;
  answers?: TestAnswer[];
}

const HEN: BookContext = {
  title: "마당을 나온 암탉",
  author: "황선미",
  tags: ["성장소설", "모험"],
};
const POOP: BookContext = {
  title: "강아지똥",
  author: "권정생",
  tags: ["동화", "자연"],
};
const MONGSIL: BookContext = {
  title: "몽실 언니",
  author: "권정생",
  tags: ["역사", "가족"],
};
const PRINCE: BookContext = {
  title: "어린 왕자",
  author: "생텍쥐페리",
  tags: ["고전", "판타지"],
};
const CHARLOTTE: BookContext = {
  title: "샬롯의 거미줄",
  author: "E.B. 화이트",
  tags: ["동화", "우정"],
};
const BADMARK: BookContext = {
  title: "나쁜 어린이 표",
  author: "황선미",
  tags: ["성장소설", "사회"],
};

export const TEST_REVIEWS: TestReview[] = [
  /* ── 1. 잘 쓴 것 (5건) — 빈틈 0~1개, 통과해야 한다 ────────── */
  {
    id: "w1",
    category: "well_written",
    gradeLevel: 5,
    book: HEN,
    expectGaps: [0, 1],
    body:
      "잎싹이 족제비에게 자기 몸을 내주는 마지막 장면에서 생각이 바뀌었다. " +
      "처음에는 잎싹이 남의 알을 품겠다고 고집부리는 게 욕심처럼 보였다. " +
      "그런데 초록이가 무리를 따라 날아간 뒤에도 잎싹이 저수지에 남아 있는 걸 보고, " +
      "잎싹이 원한 건 초록이를 가지는 게 아니라 무언가를 끝까지 지켜보는 일이었다는 걸 알았다. " +
      "족제비도 새끼를 먹여야 했으니까, 잎싹이 마지막에 순순히 내준 건 진 게 아니라고 생각한다.",
    answers: [
      {
        label: "구체적 근거",
        text: "초록이가 날아간 뒤에도 잎싹이 저수지에 남아 있었잖아. 가지고 싶었으면 따라갔을 텐데 안 갔으니까 그렇게 생각했어.",
        expectPass: true,
      },
    ],
  },
  {
    id: "w2",
    category: "well_written",
    gradeLevel: 4,
    book: POOP,
    expectGaps: [0, 1],
    body:
      "강아지똥은 자기가 더럽고 쓸모없다고 계속 울었다. " +
      "흙덩이가 와서 자기도 버려졌다고 말해줄 때도 강아지똥은 위로가 안 됐던 것 같다. " +
      "그런데 민들레가 자기를 거름으로 써야 꽃이 핀다고 하니까 그때 처음으로 울지 않았다. " +
      "누가 좋은 말을 해줘서가 아니라 자기가 쓰일 데를 알게 돼서 마음이 바뀐 거라고 생각한다.",
    answers: [
      {
        label: "장면 특정",
        text: "민들레가 거름이 필요하다고 말한 다음부터 강아지똥이 안 울었어. 그 전에 흙덩이가 위로할 때는 계속 울었거든.",
        expectPass: true,
      },
    ],
  },
  {
    id: "w3",
    category: "well_written",
    gradeLevel: 6,
    book: MONGSIL,
    expectGaps: [0, 1],
    body:
      "몽실이가 난남이를 업고 다니는 장면이 계속 생각난다. " +
      "몽실이도 다리를 절어서 걷기 힘든데 동생을 업었다. " +
      "나는 몽실이가 착해서 그런 거라고 생각했는데, 읽다 보니 착해서가 아니라 " +
      "업지 않으면 난남이가 죽으니까 어쩔 수 없이 한 것 같았다. " +
      "몽실이한테는 선택지가 없었던 거다. 그게 더 슬펐다.",
    answers: [
      {
        label: "논리 일관",
        text: "몽실이가 난남이 업고 밥 얻으러 다니는 장면에서, 안 업으면 난남이가 굶어 죽으니까 다른 방법이 없었다고 생각했어.",
        expectPass: true,
      },
    ],
  },
  {
    id: "w4",
    category: "well_written",
    gradeLevel: 5,
    book: CHARLOTTE,
    expectGaps: [0, 1],
    body:
      "샬롯이 거미줄에 글씨를 써서 윌버를 살리는 게 좀 이상하다고 생각했다. " +
      "사람들은 글씨를 보고 윌버가 특별하다고 믿었지만, 사실 특별한 건 샬롯이었다. " +
      "그런데 아무도 샬롯을 보러 오지 않았다. " +
      "샬롯이 알을 낳고 혼자 죽는 장면에서, 샬롯은 그걸 알면서도 했다는 생각이 들었다.",
    answers: [
      {
        label: "해석 근거",
        text: "사람들이 거미줄 글씨만 보고 윌버한테만 몰려갔잖아. 샬롯이 쓴 건데 샬롯 얘기는 아무도 안 했어.",
        expectPass: true,
      },
    ],
  },
  {
    id: "w5",
    category: "well_written",
    gradeLevel: 4,
    book: BADMARK,
    expectGaps: [0, 1],
    body:
      "건우가 나쁜 어린이 표를 받을 때마다 억울해하는 게 이해가 갔다. " +
      "특히 짝꿍이 먼저 건드렸는데 건우만 표를 받은 장면에서 화가 났다. " +
      "선생님은 건우가 떠드는 것만 봤지 그 전에 무슨 일이 있었는지는 못 봤다. " +
      "나중에 건우가 선생님한테 나쁜 어른 표를 주는 걸 보고, 건우가 복수한 게 아니라 " +
      "자기도 억울한 걸 알아달라고 한 거라고 생각했다.",
    answers: [
      {
        label: "장면 인용",
        text: "짝꿍이 먼저 건우 팔을 쳤는데 선생님은 건우가 소리친 것만 보고 표를 줬어. 그 장면에서 억울하다고 느꼈어.",
        expectPass: true,
      },
    ],
  },

  /* ── 2. 뭉뚱그렸지만 진짜 읽음 (5건) — 질문 나가고, 답하면 통과 ── */
  {
    id: "v1",
    category: "vague_but_read",
    gradeLevel: 4,
    book: HEN,
    expectGaps: [1, 3],
    note: "줄거리는 정확하다. 마지막 문장만 근거가 없다.",
    body:
      "잎싹은 마당을 나와서 자유를 찾고 싶어 했다. " +
      "청둥오리 알을 품어서 초록이를 키웠는데 초록이가 자기랑 다르게 생겨서 " +
      "다른 오리들이 싫어했다. 그래도 잎싹은 끝까지 초록이를 지켰다. " +
      "잎싹은 훌륭한 엄마라고 생각한다.",
    answers: [
      {
        label: "제대로 답함 — 통과해야 함",
        text: "초록이가 파수꾼 뽑힐 때 다른 오리들이 반대했는데 잎싹이 계속 옆에 있어줬어. 그래서 훌륭하다고 생각했어.",
        expectPass: true,
      },
      {
        label: "또 뭉뚱그림 — 미통과",
        text: "그냥 끝까지 잘 키워줘서요. 엄마니까 그런 거 같아요.",
        expectPass: false,
      },
    ],
  },
  {
    id: "v2",
    category: "vague_but_read",
    gradeLevel: 3,
    book: POOP,
    expectGaps: [1, 3],
    body:
      "강아지똥은 처음에 슬펐다가 나중에 기뻤다. " +
      "여러 친구들이 와서 이야기를 했다. " +
      "마지막에 민들레꽃이 피어서 좋았다. 감동적인 이야기였다.",
    answers: [
      {
        label: "제대로 답함 — 통과",
        text: "민들레가 강아지똥한테 거름이 되어달라고 했을 때 기뻐했어. 자기도 쓸모가 있다는 걸 알았으니까.",
        expectPass: true,
      },
      {
        label: "짧지만 장면 특정 — 통과해야 함",
        text: "민들레 뿌리한테 스며들 때.",
        expectPass: true,
      },
    ],
  },
  {
    id: "v3",
    category: "vague_but_read",
    gradeLevel: 5,
    book: PRINCE,
    expectGaps: [1, 3],
    body:
      "어린 왕자는 여러 별을 돌아다니면서 이상한 어른들을 많이 만났다. " +
      "그 사람들은 다 자기 일에만 빠져 있었다. " +
      "여우한테서 길들인다는 게 뭔지 배웠다. " +
      "장미가 특별한 이유를 알게 된 게 제일 중요한 부분인 것 같다.",
    answers: [
      {
        label: "제대로 답함 — 통과",
        text: "여우가 길들인다는 건 시간을 들이는 거라고 했잖아. 어린 왕자가 장미한테 물 주고 벌레 잡아준 시간이 있으니까 특별한 거야.",
        expectPass: true,
      },
    ],
  },
  {
    id: "v4",
    category: "vague_but_read",
    gradeLevel: 6,
    book: MONGSIL,
    expectGaps: [1, 3],
    body:
      "몽실이는 정말 힘들게 살았다. 전쟁 때문에 가족이 다 흩어졌다. " +
      "여러 가지 일이 많이 일어났는데 몽실이는 포기하지 않았다. " +
      "요즘 우리가 얼마나 편하게 사는지 알게 되었다.",
    answers: [
      {
        label: "제대로 답함 — 통과",
        text: "몽실이가 다리를 다치고도 난남이 업고 동냥하러 다녔잖아. 그 장면에서 포기 안 했다고 생각했어.",
        expectPass: true,
      },
    ],
  },
  {
    id: "v5",
    category: "vague_but_read",
    gradeLevel: 4,
    book: CHARLOTTE,
    expectGaps: [1, 3],
    body:
      "윌버는 처음에 죽을 뻔했는데 펀이 살려줬다. " +
      "샬롯이 도와줘서 윌버는 유명해졌다. " +
      "친구가 있어서 다행이었다. 우정은 소중한 것 같다.",
    answers: [
      {
        label: "제대로 답함 — 통과",
        text: "샬롯이 밤새 거미줄에 글씨 쓰는 장면에서 진짜 친구라고 생각했어. 자기는 얻는 게 없는데도 했으니까.",
        expectPass: true,
      },
    ],
  },

  /* ── 3. 안 읽은 것 (5건) — 미통과해야 한다 ──────────────── */
  {
    id: "n1",
    category: "not_read",
    gradeLevel: 5,
    book: HEN,
    expectGaps: [2, 3],
    note: "제목만 보고 쓴 글. 내용이 책과 다르다.",
    body:
      "이 책은 암탉이 마당에서 나가는 이야기다. " +
      "암탉이 농부한테서 도망쳐서 자유롭게 사는 내용이다. " +
      "동물들이 나와서 재밌었고 교훈도 있었다. 추천하고 싶은 책이다.",
    answers: [
      {
        label: "내용을 모름 — 미통과",
        text: "그냥 자유롭게 사는 게 좋아 보여서요. 동물들이 많이 나와서 재밌었어요.",
        expectPass: false,
      },
    ],
  },
  {
    id: "n2",
    category: "not_read",
    gradeLevel: 4,
    book: POOP,
    expectGaps: [2, 3],
    body:
      "강아지똥이라는 제목이 웃겼다. " +
      "더러운 것도 소중하다는 교훈을 주는 책이다. " +
      "읽고 나서 많은 생각을 하게 되었다. 다른 사람에게도 권하고 싶다.",
    answers: [
      { label: "미통과", text: "더러운 것도 소중하니까요.", expectPass: false },
    ],
  },
  {
    id: "n3",
    category: "not_read",
    gradeLevel: 6,
    book: PRINCE,
    expectGaps: [2, 3],
    note: "유명한 문장만 알고 쓴 글. 실제 장면은 하나도 없다.",
    body:
      "어린 왕자는 명작이다. 가장 중요한 것은 눈에 보이지 않는다는 말이 유명하다. " +
      "어른들은 숫자만 좋아한다는 것도 맞는 말인 것 같다. " +
      "어릴 때 읽으면 좋은 책이라고 생각한다.",
    answers: [
      {
        label: "미통과",
        text: "가장 중요한 건 눈에 안 보인다는 게 감동적이어서요.",
        expectPass: false,
      },
    ],
  },
  {
    id: "n4",
    category: "not_read",
    gradeLevel: 5,
    book: CHARLOTTE,
    expectGaps: [2, 3],
    body:
      "거미와 돼지가 친구가 되는 이야기다. " +
      "동물들이 말을 해서 신기했다. 마지막이 좀 슬펐다. " +
      "우정에 대해 생각해보게 되는 책이었다.",
    answers: [
      { label: "미통과", text: "동물들이 친구라서 좋았어요.", expectPass: false },
    ],
  },
  {
    id: "n5",
    category: "not_read",
    gradeLevel: 4,
    book: BADMARK,
    expectGaps: [2, 3],
    body:
      "나쁜 어린이 표를 받는 아이 이야기다. " +
      "선생님이 너무했다고 생각한다. 나도 학교에서 비슷한 일이 있었다. " +
      "재미있게 읽었다.",
    answers: [
      { label: "미통과", text: "선생님이 너무 혼내서요.", expectPass: false },
    ],
  },

  /* ── 4. 대필·AI 생성 (5건) — style_consistency 가 걸려야 한다 ── */
  {
    id: "g1",
    category: "ghostwritten",
    gradeLevel: 4,
    book: HEN,
    expectGaps: [0, 2],
    note: "독후감이 성인 문체. 아이가 시간 압박 속에 답하면 문체가 급락한다 → shifted",
    body:
      "본 작품은 정체성과 모성이라는 두 축을 교차시키며 서사를 전개한다. " +
      "주인공 잎싹은 사육의 질서에서 이탈함으로써 비로소 주체성을 획득하며, " +
      "이질적 존재인 초록이를 양육하는 과정에서 혈연을 넘어선 관계의 가능성을 제시한다. " +
      "말미의 자기희생은 순환적 생태 질서에 대한 작가의 통찰을 응축한 장면이라 하겠다.",
    answers: [
      {
        label: "아이 문체로 급락 — shifted 로 걸려야 함",
        text: "음... 그냥 엄마가 착해서요. 잘 모르겠어요.",
        expectPass: false,
      },
    ],
  },
  {
    id: "g2",
    category: "ghostwritten",
    gradeLevel: 3,
    book: POOP,
    expectGaps: [0, 2],
    note: "3학년이 쓸 수 없는 어휘. 독후감 자체로도 걸러져야 한다.",
    body:
      "권정생 작가는 하찮게 여겨지는 존재에게 고유한 효용을 부여함으로써 " +
      "존재론적 위계를 해체한다. 강아지똥의 자기 인식 과정은 " +
      "타자와의 조우를 통해 완성되며, 이는 상호주관성의 전형적 구조를 따른다.",
    answers: [
      {
        label: "아이 문체 — shifted",
        text: "민들레가 예뻐서요! 그리고 강아지똥이 착해요",
        expectPass: false,
      },
    ],
  },
  {
    id: "g3",
    category: "ghostwritten",
    gradeLevel: 5,
    book: MONGSIL,
    expectGaps: [0, 2],
    body:
      "이 소설은 한국 현대사의 격동기를 아동의 시선으로 조망한다. " +
      "몽실의 신체적 결손은 시대가 개인에게 가한 폭력의 은유이며, " +
      "그럼에도 지속되는 돌봄의 실천은 이념 대립을 초월한 인간성의 복원을 시사한다.",
    answers: [
      {
        label: "아이 문체 — shifted",
        text: "몽실이가 불쌍했어요 다리도 아픈데 동생 업어서요",
        expectPass: false,
      },
    ],
  },
  {
    id: "g4",
    category: "ghostwritten",
    gradeLevel: 4,
    book: PRINCE,
    expectGaps: [0, 2],
    note: "역방향 — 독후감은 아이 문체, 답변만 AI 로 붙여넣음",
    body:
      "어린 왕자가 여우랑 친구가 되는 게 좋았다. " +
      "여우가 길들이는 거에 대해 말해줬다. " +
      "장미가 한 송이밖에 없어서 소중하다고 했다. 나도 내 강아지가 소중하다.",
    answers: [
      {
        label: "답변만 성인·AI 문체 — shifted 로 걸려야 함",
        text: "관계의 고유성은 투여된 시간과 정성에 의해 구성되며, 어린 왕자의 장미가 지니는 유일무이함 또한 상호작용의 축적에서 비롯된다고 볼 수 있습니다.",
        expectPass: false,
      },
    ],
  },
  {
    id: "g5",
    category: "ghostwritten",
    gradeLevel: 6,
    book: CHARLOTTE,
    expectGaps: [0, 2],
    note: "역방향 — 독후감은 평범, 답변이 AI 생성",
    body:
      "윌버가 죽을 뻔했는데 샬롯이 거미줄에 글씨를 써서 살렸다. " +
      "샬롯은 마지막에 죽었지만 알을 남겼다. " +
      "친구를 위해서 그렇게까지 하는 게 대단하다고 생각했다.",
    answers: [
      {
        label: "답변만 AI 문체 — shifted",
        text: "샬롯의 헌신은 대가를 전제하지 않은 이타성의 발현이며, 유한한 생명이 남긴 알은 관계의 지속 가능성을 상징하는 장치로 기능합니다.",
        expectPass: false,
      },
    ],
  },
];

export function byCategory(category: TestCategory): TestReview[] {
  return TEST_REVIEWS.filter((review) => review.category === category);
}
