import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';

/**
 * Authoritative Ludo Backend Hub
 */
const rooms = new Map();

export function setupLudoServer(server) {
    const wss = new WebSocketServer({ server, path: '/ludo' });

    wss.on('connection', (ws) => {
        ws.on('message', (message) => {
            const { type, data } = JSON.parse(message);

            switch (type) {
                case 'CREATE_ROOM':
                    const roomId = crypto.randomBytes(3).toString('hex').toUpperCase();
                    rooms.set(roomId, { players: [data.player], state: 'LOBBY' });
                    ws.send(JSON.stringify({ type: 'ROOM_CREATED', data: { roomId } }));
                    ws.roomId = roomId;
                    break;

                case 'JOIN_ROOM':
                    const room = rooms.get(data.roomId);
                    if (room && room.players.length < 4) {
                        room.players.push(data.player);
                        ws.roomId = data.roomId;
                        broadcast(data.roomId, { type: 'PLAYER_JOINED', data: { players: room.players } });
                    } else {
                        ws.send(JSON.stringify({ type: 'ERROR', data: 'Room full or invalid' }));
                    }
                    break;

                case 'ROLL_DICE':
                    if (ws.roomId) {
                        const roll = Math.floor(Math.random() * 6) + 1;
                        broadcast(ws.roomId, { type: 'DICE_RESULT', data: { roll } });
                    }
                    break;
            }
        });

        ws.on('close', () => {
            if (ws.roomId) {
                const room = rooms.get(ws.roomId);
                if (room) {
                    room.players = room.players.filter(p => p.id !== ws.playerId);
                    if (room.players.length === 0) rooms.delete(ws.roomId);
                    else broadcast(ws.roomId, { type: 'PLAYER_LEFT', data: { players: room.players } });
                }
            }
        });
    });

    function broadcast(roomId, message) {
        wss.clients.forEach(client => {
            if (client.roomId === roomId && client.readyState === 1) {
                client.send(JSON.stringify(message));
            }
        });
    }
}
