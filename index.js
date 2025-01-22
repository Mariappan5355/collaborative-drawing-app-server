const WebSocket = require('ws');
const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Serve static files (if needed)
app.use(express.static('public'));

// Start the WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// Track connected clients
let connectedClients = new Set();

// Broadcast a message to all connected clients
const broadcast = (message, excludeWs = null) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
            client.send(JSON.stringify(message));
        }
    });
};

// Get current user count
const getUserCount = () => connectedClients.size;

// Broadcast user count to all clients
const broadcastUserCount = () => {
    broadcast({
        type: 'userCount',
        count: getUserCount()
    });
};

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New client connected');
    
    // Add client to tracking set
    connectedClients.add(ws);
    
    // Send initial user count to the new client
    ws.send(JSON.stringify({
        type: 'userCount',
        count: getUserCount()
    }));

    // Notify all users about the new connection with updated count
    broadcast({
        type: 'notification',
        message: 'A new client has connected',
        userCount: getUserCount()
    });

    // Handle incoming messages from clients
    ws.on('message', (data) => {
        try {
            const parsedData = JSON.parse(data);
            
            switch(parsedData.type) {
                case 'userConnection':
                    // Handle user connection/disconnection messages
                    if (parsedData.action === 'disconnect') {
                        connectedClients.delete(ws);
                        broadcastUserCount();
                    }
                    break;
                    
                case 'clear':
                    // Broadcast clear command to all clients
                    broadcast(parsedData);
                    break;
                    
                case 'draw':
                    // Broadcast drawing data to other clients
                    broadcast(parsedData, ws);
                    break;
                    
                default:
                    // Broadcast other messages to all clients
                    broadcast(parsedData, ws);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        
        // Remove client from tracking set
        connectedClients.delete(ws);
        
        // Notify remaining clients about disconnection with updated count
        broadcast({
            type: 'notification',
            message: 'A client has disconnected',
            userCount: getUserCount()
        });
        
        // Broadcast updated user count
        broadcastUserCount();
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connectedClients.delete(ws); // Ensure the client is removed on error
        broadcastUserCount(); // Broadcast updated user count
    });
});

// Upgrade HTTP server to handle WebSocket connections
const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
