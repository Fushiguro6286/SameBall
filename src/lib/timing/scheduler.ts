// One min-heap ordered by reveal time and a single setTimeout for the earliest entry.

interface Entry {
  id: string;
  at: number;
}

export class MinHeap {
  private a: Entry[] = [];
  get size() {
    return this.a.length;
  }
  peek(): Entry | undefined {
    return this.a[0];
  }
  push(e: Entry) {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].at <= a[i].at) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): Entry | undefined {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].at < a[m].at) m = l;
        if (r < a.length && a[r].at < a[m].at) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  clear() {
    this.a = [];
  }
}

export class RevealScheduler {
  private heap = new MinHeap();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;

  constructor(
    private now: () => number,
    private onDue: (ids: string[]) => void,
  ) {}

  /** Replace everything (used whenever lag, clock offset or pause state changes). */
  reset(entries: Entry[]) {
    this.heap.clear();
    for (const e of entries) this.heap.push(e);
    this.arm();
  }

  add(id: string, at: number) {
    this.heap.push({ id, at });
    this.arm();
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.arm();
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.heap.clear();
  }

  private arm() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const next = this.heap.peek();
    if (!next || this.paused) return;
    // Cap the wait so long lags (replays) don't overflow setTimeout's 32-bit limit.
    const wait = Math.min(Math.max(0, next.at - this.now()), 2 ** 31 - 1);
    this.timer = setTimeout(() => this.fire(), wait);
  }

  private fire() {
    this.timer = null;
    const now = this.now();
    const due: string[] = [];
    while (this.heap.size && this.heap.peek()!.at <= now) due.push(this.heap.pop()!.id);
    if (due.length) this.onDue(due);
    this.arm();
  }
}
