const User = require('../model/user');

class InMemoryUsersDb {
    #users = [];

    #initDb() {
        this.#users.push(new User("Kim Burton", 32, ['Reading', 'Music']));
        this.#users.push(new User("Anthony Li", 18, ['Java', 'Guitar playing']));
        this.#users.push(new User("Olga Krist", 32, ['Swimming', 'Jaz music']));
    }

    constructor() {
        this.#initDb();
    }

    findAll() {
        return this.#users;
    }

    findById(id) {
        const index = this.#users.findIndex(currentUser => currentUser.id === id);
        if (index !== -1) {
            return this.#users[index];
        } else {
            throw new Error('User not found');
        }
    }

    save(user) {
        this.#users.push(user);
    }

    remove(id) {
        const index = this.#users.findIndex(currentUser => currentUser.id === id);
        if (index !== -1) {
            this.#users.splice(index, 1);
        } else {
            throw new Error('User not found')
        }
    }

    update(user) {
        const index = this.#users.findIndex(currentUser => currentUser.id === user.id);
        if (index !== -1) {
            this.#users.splice(index, 1, user);
        } else {
            throw new Error('User not found');
        }
    }

}

module.exports = InMemoryUsersDb;