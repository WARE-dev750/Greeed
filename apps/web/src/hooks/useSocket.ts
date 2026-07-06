"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

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

  const connect = (id: string, name: string) => {
    setUserId(id);
    setUsername(name);
    
    localStorage.setItem('greeed_userId', id);
    localStorage.setItem('greeed_username', name);

    // Hardcode port 3001 for local MVP backend
    const newSocket = io('http://localhost:3001', {
      auth: { userId: id, username: name }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    setSocket(newSocket);
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    setIsConnected(false);
    setUserId(null);
    setUsername(null);
    localStorage.removeItem('greeed_userId');
    localStorage.removeItem('greeed_username');
  };

  useEffect(() => {
    const savedId = localStorage.getItem('greeed_userId');
    const savedName = localStorage.getItem('greeed_username');
    if (savedId && savedName && !socket) {
      connect(savedId, savedName);
    }
    
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  return React.createElement(
    SocketContext.Provider,
    { value: { socket, isConnected, userId, username, connect, disconnect } },
    children
  );
};

export const useSocket = () => useContext(SocketContext);
