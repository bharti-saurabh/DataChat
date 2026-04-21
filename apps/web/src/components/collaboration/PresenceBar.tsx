import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore.js";

const MAX_SHOWN = 4;

export function PresenceBar() {
  const localUser  = useStore((s) => s.localUser);
  const peers      = useStore((s) => s.collabUsers);
  const typingIds  = useStore((s) => s.typingUsers);

  // Always show localUser first, then peers
  const all = [localUser, ...peers];
  const shown = all.slice(0, MAX_SHOWN);
  const extra = all.length - MAX_SHOWN;

  if (all.length <= 1 && peers.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
      <AnimatePresence>
        {shown.map((user, i) => {
          const isLocal   = user.id === localUser.id;
          const isTyping  = typingIds.includes(user.id);
          const initials  = user.name.slice(0, 2).toUpperCase();

          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, scale: 0, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              title={isLocal ? `${user.name} (you)` : user.name}
              style={{
                position: "relative",
                width: 28, height: 28,
                borderRadius: "50%",
                background: user.color + "22",
                border: `2px solid ${user.color}${isLocal ? "ff" : "99"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.6rem",
                fontWeight: 700,
                color: user.color,
                cursor: "default",
                boxShadow: isLocal ? `0 0 8px ${user.color}44` : "none",
                marginLeft: i > 0 ? -6 : 0,
                zIndex: MAX_SHOWN - i,
              }}
            >
              {initials}

              {/* Online dot */}
              <span style={{
                position: "absolute",
                bottom: -1, right: -1,
                width: 7, height: 7,
                borderRadius: "50%",
                background: isTyping ? user.color : "var(--color-success)",
                border: "1.5px solid var(--color-canvas)",
                animation: isTyping ? "pulse-glow 0.8s ease-in-out infinite" : "none",
              }} />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {extra > 0 && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "var(--color-surface-3)",
          border: "2px solid var(--color-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.6rem", color: "var(--color-text-muted)",
          marginLeft: -6,
        }}>
          +{extra}
        </div>
      )}
    </div>
  );
}
