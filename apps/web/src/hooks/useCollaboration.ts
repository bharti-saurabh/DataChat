import { useEffect, useRef } from "react";
import { collabSocket } from "@/lib/ws.js";
import { useStore } from "@/store/useStore.js";
import { generateId } from "@/lib/utils.js";
import type { CollabServerMsg } from "@datachat/shared";

export function useCollaboration() {
  const {
    roomId, localUser,
    setCollabUsers, addCollabUser, removeCollabUser,
    addMessage, setTypingUsers,
  } = useStore();

  // Only connect once per (roomId, userId) pair
  const connectedKey = useRef("");

  useEffect(() => {
    if (!roomId || !localUser) return;
    const key = `${roomId}:${localUser.id}`;
    if (connectedKey.current === key) return;
    connectedKey.current = key;

    collabSocket.connect(roomId, { type: "join", user: localUser });

    const unsubscribe = collabSocket.subscribe((msg: CollabServerMsg) => {
      switch (msg.type) {
        case "welcome":
          setCollabUsers(msg.users.filter((u) => u.id !== localUser.id));
          break;

        case "user_joined":
          if (msg.user.id !== localUser.id) addCollabUser(msg.user);
          break;

        case "user_left":
          removeCollabUser(msg.userId);
          setTypingUsers((prev) => prev.filter((id) => id !== msg.userId));
          break;

        case "query_broadcast":
          // Show a read-only event card in chat when a peer runs a query
          addMessage({
            id: generateId(),
            role: "user",
            question: msg.question,
            content: msg.question,
            sql: msg.sql,
            timestamp: Date.now(),
            authorId: msg.fromUser.id,
            authorName: msg.fromUser.name,
            authorColor: msg.fromUser.color,
          });
          break;

        case "typing":
          setTypingUsers((prev) =>
            msg.isTyping
              ? prev.includes(msg.userId) ? prev : [...prev, msg.userId]
              : prev.filter((id) => id !== msg.userId),
          );
          break;
      }
    });

    return unsubscribe;
  }, [roomId, localUser, setCollabUsers, addCollabUser, removeCollabUser, addMessage, setTypingUsers]);
}
