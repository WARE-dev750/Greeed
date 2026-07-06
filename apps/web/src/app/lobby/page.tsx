"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "../../hooks/useSocket";
import { SOCKET_EVENTS } from "@greeed/shared";

export default function LobbyPage() {
  const { socket, isConnected, username } = useSocket();
  const router = useRouter();
  const [inQueue, setInQueue] = useState(false);
  const [queueLength, setQueueLength] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const handleQueueUpdate = (data: { inQueue: boolean; queueLength: number }) => {
      setInQueue(data.inQueue);
      setQueueLength(data.queueLength);
    };

    const handleMatchFound = (payload: { matchId: string }) => {
      setInQueue(false);
      router.push("/match/" + payload.matchId);
    };

    socket.on(SOCKET_EVENTS.QUEUE_UPDATE, handleQueueUpdate);
    socket.on(SOCKET_EVENTS.MATCH_FOUND, handleMatchFound);

    return () => {
      socket.off(SOCKET_EVENTS.QUEUE_UPDATE, handleQueueUpdate);
      socket.off(SOCKET_EVENTS.MATCH_FOUND, handleMatchFound);
    };
  }, [socket, router]);

  if (!isConnected) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Connecting to server...</div>;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px" }}>
      <div className="glass-panel" style={{ padding: "30px", maxWidth: "500px", width: "100%", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>Welcome, {username}</h2>
        
        <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: "10px" }}>Your Profile</p>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <div>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--primary)" }}>1000</p>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>ELO</p>
            </div>
            <div>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--success)" }}>Bronze</p>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>RANK</p>
            </div>
            <div>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#f59e0b" }}>1000</p>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>COINS</p>
            </div>
          </div>
        </div>

        {inQueue ? (
          <div style={{ padding: "20px", border: "1px dashed var(--primary)", borderRadius: "8px" }}>
            <h3 className="pulse" style={{ color: "var(--primary)", marginBottom: "10px" }}>Searching for match...</h3>
            <p style={{ color: "var(--text-secondary)" }}>Players in queue: {queueLength}</p>
            <button 
              className="btn-danger" 
              style={{ marginTop: "20px" }}
              onClick={() => socket.emit(SOCKET_EVENTS.LEAVE_QUEUE)}
            >
              Cancel Matchmaking
            </button>
          </div>
        ) : (
          <button 
            className="btn-primary pulse" 
            style={{ width: "100%", padding: "16px", fontSize: "1.2rem" }}
            onClick={() => socket.emit(SOCKET_EVENTS.JOIN_QUEUE)}
          >
            Find Match
          </button>
        )}
      </div>
    </div>
  );
}

