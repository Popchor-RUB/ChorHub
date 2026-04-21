import { Injectable } from '@nestjs/common';

interface MailQueueJob {
  run: () => Promise<void>;
}

interface MailQueueState {
  jobs: MailQueueJob[];
  processing: boolean;
  nextAllowedAt: number;
  intervalMs: number;
  onDrained?: () => void;
}

@Injectable()
export class MailQueueService {
  private readonly defaultInterval = process.env.IS_STAGING === 'true' ? 1000 : 60_000;
  private readonly queues = new Map<string, MailQueueState>();

  setOnDrained(queueName: string, onDrained: (() => void) | undefined): void {
    const queue = this.getQueue(queueName);
    queue.onDrained = onDrained;
  }

  enqueue(queueName: string, run: () => Promise<void>, intervalMs = this.defaultInterval): void {
    const queue = this.getQueue(queueName, intervalMs);
    queue.jobs.push({ run });
    if (!queue.processing) {
      void this.processQueue(queueName);
    }
  }

  enqueueMany(
    queueName: string,
    runs: Array<() => Promise<void>>,
    intervalMs = this.defaultInterval,
  ): void {
    if (runs.length === 0) {
      return;
    }
    const queue = this.getQueue(queueName, intervalMs);
    queue.jobs.push(...runs.map((run) => ({ run })));
    if (!queue.processing) {
      void this.processQueue(queueName);
    }
  }

  isRunning(queueName: string): boolean {
    const queue = this.queues.get(queueName);
    return Boolean(queue && (queue.processing || queue.jobs.length > 0));
  }

  getPendingCount(queueName: string): number {
    const queue = this.queues.get(queueName);
    return queue?.jobs.length ?? 0;
  }

  private getQueue(queueName: string, intervalMs?: number): MailQueueState {
    const existing = this.queues.get(queueName);
    if (process.env.IS_STAGING === 'true') {
      intervalMs = this.defaultInterval
    }

    if (existing) {
      if (intervalMs !== undefined) {
        existing.intervalMs = intervalMs;
      }
      return existing;
    }

    const created: MailQueueState = {
      jobs: [],
      processing: false,
      nextAllowedAt: 0,
      intervalMs: intervalMs ?? this.defaultInterval,
    };
    this.queues.set(queueName, created);
    return created;
  }

  private async processQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.processing) {
      return;
    }

    queue.processing = true;
    try {
      while (queue.jobs.length > 0) {
        const waitMs = Math.max(0, queue.nextAllowedAt - Date.now());
        if (waitMs > 0) {
          await this.sleep(waitMs);
        }

        const next = queue.jobs.shift();
        if (!next) {
          continue;
        }

        try {
          await next.run();
        } catch {
          // swallow to keep queue running
        } finally {
          queue.nextAllowedAt = Date.now() + queue.intervalMs;
        }
      }
    } finally {
      queue.processing = false;
      if (queue.jobs.length > 0) {
        void this.processQueue(queueName);
      } else if (queue.onDrained) {
        queue.onDrained();
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
