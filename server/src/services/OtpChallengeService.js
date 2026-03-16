const crypto = require('crypto');
const TimeAuthorityService = require('./TimeAuthorityService');

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

class OtpChallengeService {
    constructor() {
        this.challenges = new Map();
    }

    _nowMs() {
        return Date.now();
    }

    _buildKey(scope = 'default', actor = 'unknown') {
        return `${scope}::${actor}`;
    }

    _generateCode() {
        return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    }

    createChallenge({ scope, actor, payload = {}, ttlMs = DEFAULT_TTL_MS }) {
        const key = this._buildKey(scope, actor);
        const code = this._generateCode();
        const challenge = {
            scope,
            actor,
            payload,
            code,
            attempts_remaining: MAX_ATTEMPTS,
            created_at: TimeAuthorityService.nowIST(),
            expires_at: new Date(this._nowMs() + ttlMs).toISOString(),
        };
        this.challenges.set(key, challenge);
        return { ...challenge };
    }

    getChallenge({ scope, actor }) {
        const key = this._buildKey(scope, actor);
        const challenge = this.challenges.get(key);
        if (!challenge) return null;
        if (new Date(challenge.expires_at).getTime() <= this._nowMs()) {
            this.challenges.delete(key);
            return null;
        }
        return { ...challenge };
    }

    verifyChallenge({ scope, actor, code }) {
        const key = this._buildKey(scope, actor);
        const challenge = this.challenges.get(key);
        if (!challenge) {
            return { ok: false, error: 'No active OTP challenge found.' };
        }

        if (new Date(challenge.expires_at).getTime() <= this._nowMs()) {
            this.challenges.delete(key);
            return { ok: false, error: 'OTP expired. Request a new code.' };
        }

        if (String(code || '').trim() !== challenge.code) {
            challenge.attempts_remaining -= 1;
            if (challenge.attempts_remaining <= 0) {
                this.challenges.delete(key);
                return { ok: false, error: 'OTP failed too many times. Request a new code.' };
            }
            this.challenges.set(key, challenge);
            return { ok: false, error: `Invalid OTP. ${challenge.attempts_remaining} attempt(s) left.` };
        }

        this.challenges.delete(key);
        return { ok: true, payload: { ...challenge.payload } };
    }
}

module.exports = new OtpChallengeService();
