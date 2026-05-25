import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../utils/api';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socketRef}>
      {children}
    </SocketContext.Provider>
  );
};
