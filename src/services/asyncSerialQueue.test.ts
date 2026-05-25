import { describe, expect, it } from "vitest";
import { AsyncSerialQueue } from "./asyncSerialQueue";

describe("AsyncSerialQueue", () => {
  it("runs tasks sequentially", async () => {
    const order: number[] = [];
    const q = new AsyncSerialQueue();
    const p1 = q.enqueue(async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 5));
    });
    const p2 = q.enqueue(async () => {
      order.push(2);
    });
    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });
});
