import { useEffect, useState } from "react";
import { getAchievementDef } from "@/lib/achievements";
import { TIER_COLORS, type AchievementTier } from "@/types";

interface AchievementToastProps {
  achievementIds: string[];
  onDone: () => void;
}

const tierGlows: Record<AchievementTier, string> = {
  bronze: "shadow-[0_0_30px_rgba(205,127,50,0.4)]",
  silver: "shadow-[0_0_30px_rgba(192,192,192,0.4)]",
  gold: "shadow-[0_0_30px_rgba(255,215,0,0.5)]",
  diamond: "shadow-[0_0_40px_rgba(185,242,255,0.5)]",
};

export function AchievementToast({ achievementIds, onDone }: AchievementToastProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (currentIndex >= achievementIds.length) {
      onDone();
      return;
    }

    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), 2800);
    const nextTimer = setTimeout(() => setCurrentIndex((i) => i + 1), 3200);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
  }, [currentIndex, achievementIds.length, onDone]);

  if (currentIndex >= achievementIds.length) return null;

  const achievement = getAchievementDef(achievementIds[currentIndex]);
  if (!achievement) return null;

  const tierColor = TIER_COLORS[achievement.tier];
  const glow = tierGlows[achievement.tier];

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2">
      <div
        className={`flex items-center gap-4 rounded-2xl border bg-slate-950/95 px-6 py-4 backdrop-blur-xl transition-all duration-500 ${glow} ${
          visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"
        }`}
        style={{ borderColor: `${tierColor}55` }}
      >
        {/* Icône animée */}
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl"
          style={{ backgroundColor: `${tierColor}20` }}
        >
          <span className="animate-bounce">{achievement.icon}</span>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: tierColor }}>
            Succès débloqué !
          </p>
          <p className="text-lg font-black text-white">{achievement.name}</p>
          <p className="text-sm text-slate-400">{achievement.description}</p>
        </div>

        {/* Badge tier */}
        <div
          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: `${tierColor}20`, color: tierColor }}
        >
          {achievement.tier}
        </div>
      </div>
    </div>
  );
}
