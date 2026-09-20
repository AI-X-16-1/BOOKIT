"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/shared/api/client";
import type { ItemsResponse, BuyItemResponse, ItemKind } from "@/shared/types";
import { cn } from "@/shared/ui";

/**
 * 책갈피 상점 (④). 목업에 없는 화면이라 기존 카드 문법으로 짰다.
 *
 * spec §2b·§5b. 스키마·구매 트랜잭션은 0016 에 있고 여기는 그 위의 화면이다.
 *
 * **책갈피의 첫 소비처다.** #58 에서 열람권 교환을 철회한 뒤 "앱 안에서 실제로 전달되는
 * 보상" 으로 정한 것이라, 모은 책갈피가 어디로 가는지 보이는 자리가 이 화면이다.
 *
 * 가격을 클라이언트가 보내지 않는다 — 서버가 items 에서 읽는다. 여기 보이는 숫자는
 * 표시용이고, 잔액 확인도 서버 트랜잭션 안에서만 진짜다 (먼저 막아 두지 않는 이유는
 * rewards/server/items.ts 머리말).
 */

const KIND_LABEL: Record<ItemKind, string> = {
  hat: "모자",
  bg: "배경",
  frame: "액자",
};

export function ItemShop({ className }: { className?: string }) {
  const [data, setData] = useState<ItemsResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ItemsResponse>("/api/items")
      .then(setData)
      .catch(() => {});
  }, []);

  // 상점이 비어 있으면 줄 자체를 그리지 않는다 — 빈 칸만 있는 카드가 남지 않게
  if (!data || data.items.length === 0) return null;

  const buy = async (id: string) => {
    setBusyId(id);
    setMessage(null);
    try {
      const result = await apiPost<BuyItemResponse>(`/api/items/${id}/buy`, {});
      const owned = new Set(result.owned);
      setData((prev) =>
        prev && {
          balance: result.balance,
          items: prev.items.map((item) => ({ ...item, owned: owned.has(item.id) })),
        },
      );
    } catch (error) {
      // 서버 문구를 그대로 쓴다 — 이미 아이에게 보여줄 수 있는 반말이다 (shared/api)
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "지금은 살 수 없어. 잠깐 뒤에 다시 해볼까?",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    // 저학년 개편(목업 10 M09): "책갈피로 꾸미기" — 3열, Jua, 가격은 노랑 칩
    <section className={cn("rounded-card border-[3px] border-border bg-card px-[18px] py-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[21px] text-ink">책갈피로 꾸미기</h2>
        <span className="flex-none rounded-full bg-yellow-bg px-3 py-1 font-display text-[16px] text-yellow-text">
          🔖 {data.balance.toLocaleString()}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-[11px]">
        {data.items.map((item) => {
          const affordable = data.balance >= item.price;

          return (
            <div
              key={item.id}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-[18px] px-1.5 py-3",
                item.owned ? "border-[3px] border-green-border bg-green-bg" : "bg-sunken",
                !item.owned && !affordable && "opacity-55",
              )}
            >
              <span className="text-[30px] leading-none" aria-hidden>
                {item.emoji || "🎁"}
              </span>
              <div className="w-full truncate text-center font-display text-[15px] text-ink" title={KIND_LABEL[item.kind]}>
                {item.name}
              </div>

              {item.owned ? (
                <span className="font-display text-[14px] text-green-ink">가지고 있어</span>
              ) : (
                <button
                  type="button"
                  onClick={() => buy(item.id)}
                  disabled={busyId !== null}
                  aria-label={`${item.name} 책갈피 ${item.price}개로 사기`}
                  className={cn(
                    "mt-2.5 min-h-9 w-full rounded-full px-2 text-[11px] font-bold",
                    // 못 사는 것도 누를 수 있게 둔다. 눌러야 왜 안 되는지 문장이 나온다 —
                    // 회색으로 막아 두면 아이는 이유를 모른 채 포기한다
                    affordable
                      ? "bg-coral text-white"
                      : "border border-border bg-card text-muted",
                    busyId === item.id && "opacity-60",
                  )}
                >
                  {busyId === item.id ? "…" : `🔖 ${item.price}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {message && <p className="mt-3 text-center text-[15px] text-coral-text">{message}</p>}
    </section>
  );
}
