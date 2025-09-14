export type QueueOperationType = 'merge' | 'dismiss' | 'reviewed';

export interface QueueOperationData {
  duplicate?: unknown;
  targetAuthorId?: string;
  [key: string]: unknown;
}

export interface QueueOperation {
  id: string;
  type: QueueOperationType;
  data: QueueOperationData;
  timestamp: number;
  status: 'pending' | 'executing' | 'executed' | 'cancelled' | 'failed';
  error?: string;
}

export interface QueueManagerOptions {
  delay?: number; // Delay in milliseconds before execution
  onExecute?: (operation: QueueOperation) => Promise<void>;
  onError?: (operation: QueueOperation, error: Error) => void;
  onCancel?: (operation: QueueOperation) => void;
  onComplete?: (operation: QueueOperation) => void;
}

export class QueueManager {
  private queue: Map<string, QueueOperation> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private options: Required<QueueManagerOptions>;
  private operationCounter: number = 0;

  constructor(options: QueueManagerOptions = {}) {
    this.options = {
      delay: options.delay ?? 2000,
      onExecute: options.onExecute ?? (async () => {}),
      onError: options.onError ?? (() => {}),
      onCancel: options.onCancel ?? (() => {}),
      onComplete: options.onComplete ?? (() => {})
    };
  }

  /**
   * Enqueue an operation for delayed execution
   */
  enqueue(type: QueueOperationType, data: QueueOperationData): QueueOperation {
    const operation: QueueOperation = {
      id: `queue-op-${++this.operationCounter}`,
      type,
      data,
      timestamp: Date.now(),
      status: 'pending'
    };

    // Add to queue
    this.queue.set(operation.id, operation);

    // Set timer for execution
    const timer = setTimeout(async () => {
      await this.execute(operation.id);
    }, this.options.delay);

    this.timers.set(operation.id, timer);

    return operation;
  }

  /**
   * Cancel the most recent pending operation
   */
  cancelLast(): QueueOperation | null {
    // Find the most recent pending operation
    let mostRecent: QueueOperation | null = null;
    let mostRecentTime = 0;

    for (const op of this.queue.values()) {
      if (op.status === 'pending' && op.timestamp > mostRecentTime) {
        mostRecent = op;
        mostRecentTime = op.timestamp;
      }
    }

    if (mostRecent) {
      return this.cancel(mostRecent.id);
    }

    return null;
  }

  /**
   * Cancel a specific operation
   */
  cancel(operationId: string): QueueOperation | null {
    const operation = this.queue.get(operationId);
    if (!operation || operation.status !== 'pending') {
      return null;
    }

    // Clear timer
    const timer = this.timers.get(operationId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(operationId);
    }

    // Update status
    operation.status = 'cancelled';

    // Trigger callback
    this.options.onCancel(operation);

    return operation;
  }

  /**
   * Execute an operation immediately
   */
  async executeNow(operationId: string): Promise<void> {
    // Clear any existing timer
    const timer = this.timers.get(operationId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(operationId);
    }

    await this.execute(operationId);
  }

  /**
   * Execute all pending operations immediately
   */
  async executeAll(): Promise<void> {
    const pendingOps = Array.from(this.queue.values())
      .filter(op => op.status === 'pending')
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const op of pendingOps) {
      await this.executeNow(op.id);
    }
  }

  /**
   * Clear all operations and timers
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Clear queue
    this.queue.clear();
  }

  /**
   * Get the current queue status
   */
  getStatus(): {
    total: number;
    pending: number;
    executing: number;
    executed: number;
    cancelled: number;
    failed: number;
  } {
    const status = {
      total: this.queue.size,
      pending: 0,
      executing: 0,
      executed: 0,
      cancelled: 0,
      failed: 0
    };

    for (const op of this.queue.values()) {
      status[op.status]++;
    }

    return status;
  }

  /**
   * Get a specific operation
   */
  getOperation(operationId: string): QueueOperation | undefined {
    return this.queue.get(operationId);
  }

  /**
   * Get all operations of a specific status
   */
  getOperationsByStatus(status: QueueOperation['status']): QueueOperation[] {
    return Array.from(this.queue.values())
      .filter(op => op.status === status);
  }

  /**
   * Check if there are any pending operations
   */
  hasPending(): boolean {
    return this.getOperationsByStatus('pending').length > 0;
  }

  /**
   * Private method to execute an operation
   */
  private async execute(operationId: string): Promise<void> {
    const operation = this.queue.get(operationId);
    if (!operation || operation.status !== 'pending') {
      return;
    }

    // Clear timer if exists
    const timer = this.timers.get(operationId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(operationId);
    }

    // Update status
    operation.status = 'executing';

    try {
      // Execute the operation
      await this.options.onExecute(operation);

      // Update status
      operation.status = 'executed';

      // Trigger completion callback
      this.options.onComplete(operation);
    } catch (error) {
      // Update status
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';

      // Trigger error callback
      this.options.onError(operation, error as Error);
    }
  }

  /**
   * Clean up old completed operations to prevent memory leaks
   */
  cleanup(olderThanMs: number = 60000): void {
    const cutoffTime = Date.now() - olderThanMs;
    const toRemove: string[] = [];

    for (const [id, op] of this.queue.entries()) {
      if (
        (op.status === 'executed' ||
         op.status === 'cancelled' ||
         op.status === 'failed') &&
        op.timestamp < cutoffTime
      ) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.queue.delete(id);
    }
  }
}