"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  userId: string | null;
  username: string | null;
  connect: (userId: string, username: string) => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  userId: null,
  username: null,
  connect: () => {},
  disconnect: () => {},
});

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const SOCKET_URL =
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

  const connect = (id: string, name: string) => {
    setUserId(id);
    setUsername(name);

    localStorage.setItem("greeed_userId", id);
    localStorage.setItem("greeed_username", name);

    const newSocket = io(SOCKET_URL, {
      auth: { userId: id, username: name },
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    setSocket(newSocket);
  };

  const disconnect = () => {
    if (socket) socket.disconnect();
    setSocket(null);
    setIsConnected(false);
    setUserId(null);
    setUsername(null);
    localStorage.removeItem("greeed_userId");
    localStorage.removeItem("greeed_username");
  };

  // Auto-reconnect from localStorage on page reload
  useEffect(() => {
    const savedId = localStorage.getItem("greeed_userId");
    const savedName = localStorage.getItem("greeed_username");
    if (savedId && savedName) {
      connect(savedId, savedName);
    }
    return () => {
      socket?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return React.createElement(
    SocketContext.Provider,
    { value: { socket, isConnected, userId, username, connect, disconnect } },
    children
  );
};

export const useSocket = () => useContext(SocketContext);
