/**
 * Hybrid Logical Clock (HLC) for Glück P2P Synchronization.
 * Combines physical time (ms), logical counter, and node/device identifier
 * to provide a causal, monotonic, deterministic partial ordering across devices
 * with clock skews.
 */

export interface HlcState {
  pt: number;     // Physical time (milliseconds since epoch)
  c: number;      // Logical counter
  nodeId: string; // Unique node/device identifier for tie-breaking
}

export class HybridLogicalClock {
  private state: HlcState;
  private maxDriftMs: number;

  constructor(nodeId: string, maxDriftMs = 60000) {
    const cleanNodeId = nodeId || 'default_node';
    this.maxDriftMs = maxDriftMs;
    this.state = {
      pt: Date.now(),
      c: 0,
      nodeId: cleanNodeId
    };
  }

  get nodeId(): string {
    return this.state.nodeId;
  }

  setNodeId(id: string) {
    if (id && id.trim()) {
      this.state.nodeId = id.trim();
    }
  }

  getState(): HlcState {
    return { ...this.state };
  }

  setState(saved: Partial<HlcState>) {
    if (saved && typeof saved.pt === 'number') {
      this.state.pt = Math.max(this.state.pt, saved.pt);
    }
    if (saved && typeof saved.c === 'number') {
      this.state.c = Math.max(0, saved.c);
    }
    if (saved && typeof saved.nodeId === 'string' && saved.nodeId.trim()) {
      this.state.nodeId = saved.nodeId.trim();
    }
  }

  /**
   * Generates a new HLC timestamp for a local mutation.
   */
  now(): HlcState {
    const wallTime = Date.now();
    const ptOld = this.state.pt;
    const cOld = this.state.c;

    if (wallTime > ptOld) {
      this.state.pt = wallTime;
      this.state.c = 0;
    } else {
      this.state.c = cOld + 1;
    }

    return { ...this.state };
  }

  /**
   * Updates local HLC state upon receiving a remote HLC timestamp.
   */
  update(remote: { pt: number; c: number; nodeId?: string }): HlcState {
    if (!remote || typeof remote.pt !== 'number' || typeof remote.c !== 'number') {
      return this.now();
    }

    const wallTime = Date.now();
    const ptOld = this.state.pt;
    const cOld = this.state.c;

    const remotePt = remote.pt;
    const remoteC = remote.c;

    const maxPt = Math.max(ptOld, remotePt, wallTime);

    if (maxPt === ptOld && maxPt === remotePt) {
      this.state.c = Math.max(cOld, remoteC) + 1;
    } else if (maxPt === ptOld) {
      this.state.c = cOld + 1;
    } else if (maxPt === remotePt) {
      this.state.c = remoteC + 1;
    } else {
      this.state.c = 0;
    }

    this.state.pt = maxPt;
    return { ...this.state };
  }

  /**
   * Compares two HLC timestamps or legacy updatedAt/HLC objects.
   * Returns:
   *  1 if a > b
   * -1 if a < b
   *  0 if a == b
   */
  static compare(
    a: { pt?: number; c?: number; nodeId?: string; updatedAt?: any },
    b: { pt?: number; c?: number; nodeId?: string; updatedAt?: any }
  ): number {
    const aHlc = HybridLogicalClock.toHlc(a);
    const bHlc = HybridLogicalClock.toHlc(b);

    if (aHlc.pt !== bHlc.pt) {
      return aHlc.pt > bHlc.pt ? 1 : -1;
    }
    if (aHlc.c !== bHlc.c) {
      return aHlc.c > bHlc.c ? 1 : -1;
    }
    // Tie-breaker by node ID / device ID / revision
    if (aHlc.nodeId !== bHlc.nodeId) {
      return aHlc.nodeId > bHlc.nodeId ? 1 : -1;
    }
    return 0;
  }

  /**
   * Normalizes any record or object into a standardized HlcState view.
   */
  static toHlc(record: { pt?: number; c?: number; nodeId?: string; updatedAt?: any; originRevision?: any; deviceId?: any }): HlcState {
    if (record && typeof record.pt === 'number' && typeof record.c === 'number') {
      return {
        pt: record.pt,
        c: record.c,
        nodeId: record.nodeId || record.deviceId || String(record.originRevision || 'legacy')
      };
    }

    // Fallback to parsing legacy updatedAt (string or number)
    const rawUpdatedAt = record?.updatedAt;
    let parsedPt = 0;
    if (typeof rawUpdatedAt === 'number' && !isNaN(rawUpdatedAt)) {
      parsedPt = rawUpdatedAt;
    } else if (typeof rawUpdatedAt === 'string' && rawUpdatedAt.trim()) {
      parsedPt = Date.parse(rawUpdatedAt);
      if (isNaN(parsedPt)) parsedPt = 0;
    }

    return {
      pt: parsedPt || 1,
      c: 0,
      nodeId: record?.nodeId || record?.deviceId || String(record?.originRevision || 'legacy')
    };
  }
}

// Global default singleton instance for local runtime
export const globalHlc = new HybridLogicalClock('local_device');
