"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheHelper = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../shared/logger");
/**
 * Reusable In-Memory Cache Utility
 */
class CacheService {
    constructor(ttlSeconds = 600) {
        this.hits = 0;
        this.misses = 0;
        this.cache = new node_cache_1.default({
            stdTTL: ttlSeconds,
            checkperiod: ttlSeconds * 0.2,
            useClones: false,
        });
    }
    /**
     * Get data from cache
     */
    get(key) {
        const start = Date.now();
        const value = this.cache.get(key);
        if (value) {
            this.hits++;
            logger_1.logger.info(`[CACHE] HIT: ${key} (${Date.now() - start}ms)`);
        }
        else {
            this.misses++;
            logger_1.logger.info(`[CACHE] MISS: ${key}`);
        }
        return value;
    }
    /**
     * Get cache stats
     */
    getStats() {
        const total = this.hits + this.misses;
        const ratio = total === 0 ? 0 : (this.hits / total) * 100;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRatio: `${ratio.toFixed(2)}%`,
            keys: this.cache.keys().length,
        };
    }
    /**
     * Set data in cache
     */
    set(key, value, ttl) {
        return this.cache.set(key, value, ttl || 600);
    }
    /**
     * Delete key from cache
     */
    del(key) {
        return this.cache.del(key);
    }
    /**
     * Clear cache by prefix
     */
    clearByPrefix(prefix) {
        const keys = this.cache.keys();
        const keysToDelete = keys.filter(key => key.startsWith(prefix));
        if (keysToDelete.length > 0) {
            this.cache.del(keysToDelete);
            logger_1.logger.info(`[CACHE] Invalidated ${keysToDelete.length} keys with prefix: ${prefix}`);
        }
    }
    /**
     * Flush all cache
     */
    flush() {
        this.cache.flushAll();
        logger_1.logger.info('[CACHE] Flushed all keys');
    }
}
// Export a singleton instance
exports.cacheHelper = new CacheService();
