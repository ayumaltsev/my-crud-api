const http = require('http');
const {v4: uuidv4, validate: isUUID} = require('uuid');
const User = require('./model/user');
const InMemoryUsersDb = require('./db/inMemoryUsersDb');

const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === "production" ? ".env.prod" : ".env.dev";
dotenv.config({ path: envFile });

const db = new InMemoryUsersDb();

const invalidUserIdMessage = 'UserId is invalid (not uuid)!';
const notFoundUserMessage = 'User not found';
const invalidUserInfoMessage = 'Invalid user data: username (non-empty string), age>0 (number), hobbies (array) are required';
const internalServerErrorMessage = 'An error on the server side occurred during the processing of a request';

const server = http.createServer((req, res) => {

    try {
        const method = req.method;
        const url = req.url;

        if ((url === "/api/users" || url === "/api/users/") && method === "GET") {
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

        if (url.startsWith("/api/users/") && method === "DELETE") {
            const userId = url.split("/")[3];

            if (!isUUID(userId)) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: invalidUserIdMessage}));
                return;
            }

            try {
                db.remove(userId);
                res.writeHead(204, {'Content-Type': 'application/json'});
                res.end();
                return;
            } catch (error) {
                res.writeHead(404, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: notFoundUserMessage}));
                return;
            }
        }

        if ((url === "/api/users" || url === "/api/users/") && method === "POST") {
            let body = '';

            req.on('data', chunk => {
                body += chunk;
            });

            req.on('end', () => {
                try {
                    const {username, age, hobbies} = JSON.parse(body);

                    if (!username || typeof username !== 'string' || username.trim() === ''
                        || !Number.isInteger(age) || Number(age) < 0
                        || !Array.isArray(hobbies)) {
                        throw new Error(invalidUserInfoMessage);
                    }

                    const newUser = {id: uuidv4(), username, age, hobbies};
                    db.save(newUser);
                    res.writeHead(201, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(newUser));
                } catch (error) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: error.message}));
                }
            });

            return;
        }

        if (url.startsWith("/api/users/") && method === "PUT") {
            const userId = url.split("/")[3];
            let body = '';

            if (!isUUID(userId)) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: invalidUserIdMessage}));
                return;
            }

            req.on('data', chunk => {
                body += chunk;
            });

            req.on('end', () => {
                try {
                    const {username, age, hobbies} = JSON.parse(body);

                    if (!username || typeof username !== 'string' || username.trim() === ''
                        || !Number.isInteger(age) || Number(age) < 0
                        || !Array.isArray(hobbies)) {
                        throw new Error(invalidUserInfoMessage);
                    }

                    const updatedUser = {id: userId, username, age, hobbies};
                    db.update(updatedUser);
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(updatedUser));

                } catch (error) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: error.message}));
                }
            });

            return;
        }

        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: "Route not found"}));

    } catch (error) {
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: internalServerErrorMessage}));
        return;
    }
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});