"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "../hooks/useSocket";

export default function LandingPage() {
  const [username, setUsername] = useState("");
  const { connect, isConnected } = useSocket();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.push("/lobby");
    }
  }, [isConnected, router]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    const id = "user-" + Math.random().toString(36).substring(2, 10);
    connect(id, username);
  };

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass-panel" style={{ padding: "48px", maxWidth: "420px", width: "100%", textAlign: "center" }}>
        <h1 style={{ marginBottom: "8px", fontSize: "2.8rem", fontWeight: "bold", letterSpacing: "-1px" }}>
          Split or Steal
        </h1>
        <p style={{ color: "var(--primary)", marginBottom: "36px", fontWeight: 600, fontSize: "1rem" }}>
          Can you trust the person in front of you?
        </p>
        <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input
            type="text"
            placeholder="Enter your alias"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
            maxLength={20}
            required
            style={{ textAlign: "center", fontSize: "1.1rem" }}
          />
          <button type="submit" className="btn-primary" style={{ fontSize: "1.1rem", marginTop: "8px" }}>
            Enter Arena
          </button>
        </form>
      </div>
    </div>
  );
}
