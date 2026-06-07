/**
 * OAuth State Store
 * 
 * In-memory storage for OAuth state parameters.
 * Per repository constitution: No Redis, no database, no external storage.
 * 
 * State persistence requirements:
 * - Store generated state for CSRF validation
 * - Track creation timestamp
 * - Expire after 10 minutes
 * - Remove after consumption (callback handling)
 * 
 * Implementation: Simple Map<string, Date>
 */

/**
 * OAuth State Store
 * 
 * Manages OAuth state lifecycle for CSRF protection.
 */
export class OAuthStateStore {
  private readonly states: Map<string, Date> = new Map();
  private readonly STATE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Store OAuth state parameter
   * 
   * @param state - OAuth state value to store
   */
  store(state: string): void {
    this.states.set(state, new Date());
  }

  /**
   * Validate OAuth state parameter
   * 
   * Checks if state exists and is not expired.
   * Does NOT consume the state (removal happens separately).
   * 
   * @param state - OAuth state value to validate
   * @returns true if state exists and is valid, false otherwise
   */
  validate(state: string): boolean {
    const createdAt = this.states.get(state);

    if (!createdAt) {
      return false; // State not found
    }

    const now = Date.now();
    const age = now - createdAt.getTime();

    if (age > this.STATE_EXPIRATION_MS) {
      this.states.delete(state); // Remove expired state
      return false;
    }

    return true;
  }

  /**
   * Consume OAuth state parameter
   * 
   * Removes state after successful consumption (callback validation).
   * Prevents state reuse.
   * 
   * @param state - OAuth state value to consume
   */
  consume(state: string): void {
    this.states.delete(state);
  }

  /**
   * Clean up expired states
   * 
   * Should be called periodically to prevent memory growth.
   * Removes all states older than expiration time.
   * 
   * @returns Number of states removed
   */
  cleanExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [state, createdAt] of this.states.entries()) {
      const age = now - createdAt.getTime();
      if (age > this.STATE_EXPIRATION_MS) {
        this.states.delete(state);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get current state count
   * 
   * Useful for monitoring and debugging.
   * 
   * @returns Number of states currently stored
   */
  getCount(): number {
    return this.states.size;
  }
}
