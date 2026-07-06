"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "../../../hooks/useSocket";
import { SOCKET_EVENTS, MatchState, ChatMessage, GameChoice } from "@greeed/shared";

export default function MatchArena() {
  const params = useParams();
  const matchId = params.matchId as string;
  const { socket, isConnected, userId } = useSocket();
  const router = useRouter();

  const [roomState, setRoomState] = useState<MatchState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [opponentSignal, setOpponentSignal] = useState<"GREEN" | "RED" | null>(null);
  const [myTentative, setMyTentative] = useState<GameChoice | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { matchId });

    socket.on(SOCKET_EVENTS.ROOM_STATE, (state: MatchState) => {
      setRoomState(state);
      setMessages(state.messages);
    });

    socket.on(SOCKET_EVENTS.TIMER_TICK, (data: { timerRemaining: number }) => {
      setRoomState(prev => prev ? { ...prev, timerRemaining: data.timerRemaining } : null);
    });

    socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on(SOCKET_EVENTS.SIGNAL_UPDATE, (data: any) => {
      if (!roomState) return;
      const isPlayer1 = userId === roomState.player1.id;
      setOpponentSignal(isPlayer1 ? data.player2Signal : data.player1Signal);
    });

    socket.on(SOCKET_EVENTS.CHOICE_LOCKED, () => {
      setIsLocked(true);
    });

    socket.on(SOCKET_EVENTS.MATCH_RESULT, (result: any) => {
      setMatchResult(result);
    });

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_STATE);
      socket.off(SOCKET_EVENTS.TIMER_TICK);
      socket.off(SOCKET_EVENTS.RECEIVE_MESSAGE);
      socket.off(SOCKET_EVENTS.SIGNAL_UPDATE);
      socket.off(SOCKET_EVENTS.CHOICE_LOCKED);
      socket.off(SOCKET_EVENTS.MATCH_RESULT);
    };
  }, [socket, isConnected, matchId, roomState?.player1?.id, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit(SOCKET_EVENTS.SEND_MESSAGE, { matchId, text: chatInput });
    setChatInput("");
  };

  const selectTentative = (choice: GameChoice) => {
    if (isLocked || !socket) return;
    setMyTentative(choice);
    socket.emit(SOCKET_EVENTS.SELECT_TENTATIVE, { matchId, choice });
  };

  const lockChoice = () => {
    if (isLocked || !myTentative || !socket) return;
    socket.emit(SOCKET_EVENTS.SUBMIT_CHOICE, { matchId, choice: myTentative });
  };

  if (!roomState) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading arena...</div>;
  }

  const isPlayer1 = userId === roomState.player1.id;
  const opponent = isPlayer1 ? roomState.player2 : roomState.player1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", padding: "20px" }}>
      {/* Header */}
      <div className="glass-panel" style={{ display: "flex", justifyContent: "space-between", padding: "20px", marginBottom: "20px" }}>
        <div>
          <h2 style={{ color: "var(--danger)" }}>Opponent: {opponent.username}</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Rank: {opponent.rank} | Split Rate: {opponent.splitRate}%</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <h1 className="pulse" style={{ fontSize: "2.5rem", margin: 0, color: roomState.status === "DECISION" ? "var(--danger)" : "var(--primary)" }}>
            {Math.floor(roomState.timerRemaining / 60)}:{(roomState.timerRemaining % 60).toString().padStart(2, "0")}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontWeight: "bold" }}>{roomState.status}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 style={{ color: "var(--success)" }}>Stake: {roomState.stake} Coins</h2>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ display: "flex", flex: 1, gap: "20px", overflow: "hidden" }}>
        
        {/* Chat Panel */}
        <div className="glass-panel" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ alignSelf: msg.senderId === userId ? "flex-end" : "flex-start", background: msg.senderId === userId ? "var(--primary)" : "var(--surface)", padding: "10px 15px", borderRadius: "8px", maxWidth: "80%" }}>
                <p style={{ fontSize: "0.8rem", color: msg.senderId === userId ? "rgba(255,255,255,0.7)" : "var(--text-secondary)", marginBottom: "4px" }}>{msg.senderName}</p>
                <p>{msg.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendChat} style={{ display: "flex", padding: "15px", borderTop: "1px solid var(--border)" }}>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Negotiate, lie, promise..."
              className="input-field"
              style={{ flex: 1, marginRight: "10px" }}
              disabled={roomState.status !== "CHAT"}
            />
            <button type="submit" className="btn-primary" disabled={roomState.status !== "CHAT"}>Send</button>
          </form>
        </div>

        {/* Decision Panel */}
        <div className="glass-panel" style={{ width: "400px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          
          <div style={{ marginBottom: "40px", textAlign: "center" }}>
            <h3 style={{ color: "var(--text-secondary)", marginBottom: "15px" }}>Opponent Signal</h3>
            <div style={{ 
              width: "100px", height: "100px", borderRadius: "50%", margin: "0 auto",
              background: opponentSignal === "GREEN" ? "var(--success)" : opponentSignal === "RED" ? "var(--danger)" : "var(--surface)",
              boxShadow: opponentSignal === "GREEN" ? "0 0 40px var(--success)" : opponentSignal === "RED" ? "0 0 40px var(--danger)" : "none",
              transition: "all 0.3s ease"
            }} />
            <p style={{ marginTop: "10px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>65% Accuracy</p>
          </div>

          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
              <button 
                onMouseEnter={() => selectTentative("SPLIT")}
                onClick={() => selectTentative("SPLIT")}
                className="btn-success"
                style={{ flex: 1, padding: "20px", opacity: myTentative === "SPLIT" ? 1 : 0.5 }}
                disabled={isLocked || roomState.status !== "DECISION"}
              >
                SPLIT
              </button>
              <button 
                onMouseEnter={() => selectTentative("STEAL")}
                onClick={() => selectTentative("STEAL")}
                className="btn-danger"
                style={{ flex: 1, padding: "20px", opacity: myTentative === "STEAL" ? 1 : 0.5 }}
                disabled={isLocked || roomState.status !== "DECISION"}
              >
                STEAL
              </button>
            </div>
            
            <button 
              onClick={lockChoice}
              className="btn-primary pulse"
              style={{ width: "100%", padding: "15px" }}
              disabled={isLocked || !myTentative || roomState.status !== "DECISION"}
            >
              {isLocked ? "LOCKED IN" : "LOCK CHOICE"}
            </button>
          </div>
        </div>

      </div>

      {/* Result Overlay */}
      {matchResult && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <h1 style={{ fontSize: "4rem", marginBottom: "40px", color: "white", textTransform: "uppercase" }}>
            {matchResult.player1Choice === "SPLIT" && matchResult.player2Choice === "SPLIT" ? "Mutual Trust" :
             matchResult.player1Choice === "STEAL" && matchResult.player2Choice === "STEAL" ? "Mutual Greed" :
             "Betrayal!"}
          </h1>
          
          <div style={{ display: "flex", gap: "60px", marginBottom: "40px" }}>
            <div style={{ textAlign: "center", background: "var(--surface)", padding: "30px", borderRadius: "12px", border: isPlayer1 ? "2px solid var(--primary)" : "2px solid var(--border)" }}>
              <h2 style={{ marginBottom: "15px", color: "white" }}>Player 1 Choice</h2>
              <p style={{ fontSize: "2rem", color: matchResult.player1Choice === "SPLIT" ? "var(--success)" : "var(--danger)", fontWeight: "bold" }}>{matchResult.player1Choice}</p>
              <p style={{ marginTop: "15px", color: matchResult.player1CoinsChange >= 0 ? "var(--success)" : "var(--danger)" }}>{matchResult.player1CoinsChange >= 0 ? "+" : ""}{matchResult.player1CoinsChange} Coins</p>
              <p style={{ color: matchResult.player1EloChange >= 0 ? "var(--success)" : "var(--danger)" }}>{matchResult.player1EloChange >= 0 ? "+" : ""}{matchResult.player1EloChange} Elo</p>
            </div>
            
            <div style={{ textAlign: "center", background: "var(--surface)", padding: "30px", borderRadius: "12px", border: !isPlayer1 ? "2px solid var(--primary)" : "2px solid var(--border)" }}>
              <h2 style={{ marginBottom: "15px", color: "white" }}>Player 2 Choice</h2>
              <p style={{ fontSize: "2rem", color: matchResult.player2Choice === "SPLIT" ? "var(--success)" : "var(--danger)", fontWeight: "bold" }}>{matchResult.player2Choice}</p>
              <p style={{ marginTop: "15px", color: matchResult.player2CoinsChange >= 0 ? "var(--success)" : "var(--danger)" }}>{matchResult.player2CoinsChange >= 0 ? "+" : ""}{matchResult.player2CoinsChange} Coins</p>
              <p style={{ color: matchResult.player2EloChange >= 0 ? "var(--success)" : "var(--danger)" }}>{matchResult.player2EloChange >= 0 ? "+" : ""}{matchResult.player2EloChange} Elo</p>
            </div>
          </div>

          <button className="btn-primary" onClick={() => router.push("/lobby")} style={{ padding: "15px 40px", fontSize: "1.2rem" }}>
            Return to Lobby
          </button>
        </div>
      )}
    </div>
  );
}

