/**
 * 将异步任务串行化，避免 VLM 等网络调用并发打满或竞态。
 */
export class AsyncSerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(() => fn());
    this.tail = run.then(
      () => {},
      () => {}
    );
    return run;
  }
}
