import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        socketRef.current = io('/', { transports: ['websocket', 'polling'] });

        socketRef.current.on('connect', () => setIsConnected(true));
        socketRef.current.on('disconnect', () => setIsConnected(false));

        socketRef.current.on('generation-status', (data) => setStatus(data));
        socketRef.current.on('renovation-status', (data) => setStatus(data));

        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

    const joinProject = (projectId) => {
        socketRef.current?.emit('join-project', projectId);
    };

    return { socket: socketRef.current, isConnected, status, joinProject };
}
