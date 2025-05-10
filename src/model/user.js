const {v4: uuidv4} = require('uuid');

class User {
    constructor(username, age, hobbies = []) {
        if (!username.trim() || typeof username !== 'string') {
            throw new Error("User name must be a non empty string");
        }
        if (!Number.isInteger(age) || age < 0) {
            throw new Error("User age must be a positive number");
        }
        if (!Array.isArray(hobbies) || !hobbies.every(h => typeof h === 'string')) {
            throw new Error("Hobbies must be an array of strings");
        }

        this.id = uuidv4();
        this.username = username;
        this.age = age;
        this.hobbies = hobbies;
    }
}
