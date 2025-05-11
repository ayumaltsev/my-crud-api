const http = require('http');
const {v4: uuidv4, validate: isUUID} = require('uuid');
const User = require('./model/user');
const InMemoryUsersDb = require('./db/inMemoryUsersDb');

const db = new InMemoryUsersDb();

const invalidUserIdMessage = 'UserId is invalid (not uuid)!';
const notFoundUserMessage = 'User not found';

const server = http.createServer((req, res) => {

    const method = req.method;
    const url = req.url;

    if (url === "/api/users" && method === "GET") {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(db.findAll()));
        return;
    }

    if (url.startsWith("/api/users/") && method === "GET") {
        const userId = url.split("/")[3];

        if (!isUUID(userId)) {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: invalidUserIdMessage}));
            return;
        }

        try {
            const user = db.findById(userId);
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(user));
            return;
        } catch (error) {
            res.writeHead(404, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: notFoundUserMessage}));
            return;
        }

    }

    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: "Route not found"}));
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});