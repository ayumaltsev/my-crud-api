const http = require('http');
const cluster = require('cluster');
const os = require('os');
const {v4: uuidv4, validate: isUUID} = require('uuid');
const User = require('./model/user');
const InMemoryUsersDb = require('./db/inMemoryUsersDb');

const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === "production" ? ".env.prod" : ".env.dev";
dotenv.config({path: envFile});

const invalidUserIdMessage = 'UserId is invalid (not uuid)!';
const notFoundUserMessage = 'User not found';
const invalidUserInfoMessage = 'Invalid user data: username (non-empty string), age>0 (number), hobbies (array) are required';
const internalServerErrorMessage = 'An error on the server side occurred during the processing of a request';

const PORT = process.env.PORT || 4000;

const numWorkers = os.availableParallelism() - 1;

if (cluster.isPrimary) {
    console.log(`Primary process ${process.pid} is running`);

    const globalDb = new InMemoryUsersDb();

    for (let i = 1; i <= numWorkers; i++) {
        const worker = cluster.fork({WORKER_PORT: PORT + i});

        worker.on('message', (msg) => {
            try {
                if (msg.action === 'findAll') {
                    worker.send({action: 'responseAll', users: globalDb.findAll()});

                } else if (msg.action === 'find') {
                    const user = globalDb.findById(msg.userId)
                    worker.send({action: 'response', user});

                } else if (msg.action === 'create') {
                    globalDb.save(msg.user);
                    worker.send({action: 'created', user: msg.user});

                } else if (msg.action === 'delete') {
                    globalDb.remove(msg.userId);
                    worker.send({action: 'deleted'});

                } else if (msg.action === 'update') {
                    globalDb.update(msg.user);
                    worker.send({action: 'updated', user: msg.user});
                }

            } catch (error) {
                worker.send({action: 'error', error: error.message});
            }
        });
    }

    let currentWorker = 1;

    http.createServer((req, res) => {
        const workerPort = PORT + currentWorker;
        currentWorker = (currentWorker % numWorkers) + 1; // Round-robin

        const options = {
            hostname: 'localhost',
            port: workerPort,
            path: req.url,
            method: req.method,
            headers: req.headers
        };

        const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        req.pipe(proxyReq);
    }).listen(PORT, () => {
        console.log(`Load balancer running at http://localhost:${PORT}/api`);
    });

    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} exited, restarting...`);
        cluster.fork();
    });
} else {
    const workerPort = process.env.WORKER_PORT;
    const server = http.createServer((req, res) => {

        try {
            const method = req.method;
            const url = req.url;

            if ((url === "/api/users" || url === "/api/users/") && method === "GET") {
                process.send({action: 'findAll'});
                process.once('message', (msg) => {
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify(msg.users));
                });

                return;
            }

            if (url.startsWith("/api/users/") && method === "GET") {
                const userId = url.split("/")[3];

                if (!isUUID(userId)) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: invalidUserIdMessage}));
                    return;
                }

                process.send({action: 'find', userId});
                process.once('message', (msg) => {
                    try {
                        if (msg.action === 'response') {
                            res.writeHead(200, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify(msg.user));
                        } else if (msg.action === 'error') {
                            res.writeHead(404, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify({error: msg.error}));
                        }
                    } catch (error) {
                        res.writeHead(500, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: internalServerErrorMessage}));
                    }
                });
                return;
            }

            if (url.startsWith("/api/users/") && method === "DELETE") {
                const userId = url.split("/")[3];

                if (!isUUID(userId)) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: invalidUserIdMessage}));
                    return;
                }

                process.send({action: 'delete', userId});
                process.once('message', (msg) => {
                    try {
                        if (msg.action === 'deleted') {
                            // if (!res.headersSent) {
                            //     res.writeHead(204, {'Content-Type': 'application/json'});
                            // }
                            res.writeHead(200,{});
                            res.end();
                            return;
                        } else if (msg.action === 'error') {
                            res.writeHead(404, {'Content-Type': 'application/json'});
                            res.end(JSON.stringify({error: msg.error}));
                            return;
                        }
                    } catch (error) {
                        res.writeHead(500, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({error: internalServerErrorMessage}));
                    }
                });
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

                        process.send({action: 'create', user: newUser});

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

                        process.send({action: 'update', user: updatedUser});

                        process.onc('message', (msg) => {
                            if (msg.action === 'updated') {
                                res.writeHead(200, {'Content-Type': 'application/json'});
                                res.end(JSON.stringify(msg.user));
                            } else if (msg.action === 'error') {
                                res.writeHead(404, {'Content-Type': 'application/json'});
                                res.end(JSON.stringify({error: msg.error}));
                            }
                        });

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

    server.listen(workerPort, () => {
        console.log(`Worker ${process.pid} running at http://localhost:${workerPort}/api`);
    });
}


