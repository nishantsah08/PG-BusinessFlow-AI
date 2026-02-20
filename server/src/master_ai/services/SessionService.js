const fs = require('fs');
const path = require('path');

class SessionService {
    constructor() {
        this.sessionFile = path.join(__dirname, '../data/sessions.json');
        this.sessions = {};
        this.loadSessions();
    }

    loadSessions() {
        if (fs.existsSync(this.sessionFile)) {
            try {
                this.sessions = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
                console.log('Sessions loaded from disk.');
            } catch (error) {
                console.error('Failed to load sessions:', error);
                this.sessions = {};
            }
        } else {
            // Ensure directory exists
            const dir = path.dirname(this.sessionFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.sessionFile, JSON.stringify({}, null, 2));
            this.sessions = {};
        }
    }

    saveSessions() {
        fs.writeFileSync(this.sessionFile, JSON.stringify(this.sessions, null, 2));
    }

    getSession(userId) {
        return this.sessions[userId] || null;
    }

    createOrUpdateSession(userId, data) {
        if (!this.sessions[userId]) {
            this.sessions[userId] = {
                userId,
                createdAt: new Date().toISOString(),
                state: {},
                history: []
            };
        }

        // Merge state
        this.sessions[userId].state = { ...this.sessions[userId].state, ...data };
        this.sessions[userId].updatedAt = new Date().toISOString();

        this.saveSessions();
        return this.sessions[userId];
    }

    addToHistory(userId, interaction) {
        if (!this.sessions[userId]) return;
        this.sessions[userId].history.push({
            ...interaction,
            timestamp: new Date().toISOString()
        });
        this.saveSessions();
    }

    finalizeSession(userId, reason) {
        if (this.sessions[userId]) {
            // Logic to archive or reset session could go here
            console.log(`Finalizing session for ${userId}. Reason: ${reason}`);
            this.sessions[userId].lastFinalized = new Date().toISOString();
            this.saveSessions();
            return true;
        }
        return false;
    }

    resetAll() {
        this.sessions = {};
        this.saveSessions();
        console.log('All sessions reset.');
    }
}

module.exports = SessionService;
