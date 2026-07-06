"use client";
import { useRouter } from "next/navigation";
export default function RegisterPage() {
  const router = useRouter();
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>Register</h1>
      <p style={{ color: "var(--text-secondary)" }}>Use the landing page to enter the arena.</p>
      <button className="btn-primary" style={{ marginTop: "20px" }} onClick={() => router.push("/")}>Go to Arena</button>
    </div>
  );
}
