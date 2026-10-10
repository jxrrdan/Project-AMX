import { Directive, ElementRef, OnDestroy, inject, input, output } from '@angular/core';
import { PointerSample, isSettled, project, releaseVelocity, rubberbandClamp, stepSpring } from './fluid-motion';

export interface FlickDropEvent<T = unknown> {
  data: T;
  /** The `data-drop-zone` id of the zone the card was thrown or dropped into. */
  zone: string;
}

const START_THRESHOLD_PX = 10; // hysteresis before a press becomes a drag
const FLICK_MIN_SPEED = 250; // px/s below which release means "drop where the pointer is"
const DECELERATION = 0.992; // snappier than scroll's 0.998, so a flick lands a column or two away
const INTERACTIVE = 'a, button, input, select, textarea, [data-no-drag]';

type Phase = 'idle' | 'pending' | 'dragging' | 'settling';

/**
 * Fluid drag between drop zones (elements marked `data-drop-zone="<id>"`), built from the Apple
 * "Designing Fluid Interfaces" rules:
 *
 *  - responds on pointer-down (the card lifts immediately) and tracks 1:1, keeping the grab offset;
 *  - on release, projects the flick's momentum to choose the destination (not just the release point);
 *  - settles with a spring that inherits the release velocity (critically damped, a touch of bounce
 *    only when the gesture carried momentum), animating x and y independently;
 *  - is interruptible: grab the card mid-flight and it follows you from its live position;
 *  - rubber-bands at the edge of the bounds instead of stopping hard;
 *  - Escape cancels; reduced-motion users get a direct move with no springs.
 *
 * Keyboard and assistive-technology users move cards with the explicit "Move to…" menu instead.
 */
@Directive({
  selector: '[appFlickDrag]',
  host: {
    '[style.touch-action]': '"none"',
    '[style.user-select]': '"none"',
    '(pointerdown)': 'onPointerDown($event)',
  },
})
export class FlickDragDirective implements OnDestroy {
  readonly appFlickDrag = input<unknown>();
  readonly flickDrop = output<FlickDropEvent>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private phase: Phase = 'idle';
  private pointerId = -1;
  private captureTarget: HTMLElement | null = null;
  private startX = 0;
  private startY = 0;
  private grabX = 0;
  private grabY = 0;
  private preview: HTMLElement | null = null;
  private x = 0;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private samples: PointerSample[] = [];
  private hoverZone: HTMLElement | null = null;
  private raf = 0;
  private readonly reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly move = (e: PointerEvent) => this.onPointerMove(e);
  private readonly up = (e: PointerEvent) => this.onPointerUp(e);
  private readonly cancel = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    if (this.phase === 'dragging') this.release(0, 0, true);
    else if (this.phase === 'pending') this.reset();
  };
  private readonly key = (e: KeyboardEvent) => e.key === 'Escape' && this.phase === 'dragging' && this.release(0, 0, true);

  onPointerDown(e: PointerEvent): void {
    if (this.phase !== 'idle' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    this.phase = 'pending';
    this.pointerId = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    const rect = this.host.getBoundingClientRect();
    this.grabX = e.clientX - rect.left; // respect where it was grabbed; never snap to the centre
    this.grabY = e.clientY - rect.top;
    this.capture(this.host, e.pointerId);
    this.listen();
    // Feedback on press, instantly: the card lifts before it has moved at all.
    this.host.classList.add('amx-pressed');
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    if (this.phase === 'pending') {
      if (Math.hypot(e.clientX - this.startX, e.clientY - this.startY) < START_THRESHOLD_PX) return;
      this.beginDrag();
    }
    if (this.phase !== 'dragging') return;
    const bounds = this.bounds();
    const w = this.preview?.offsetWidth ?? 0;
    const h = this.preview?.offsetHeight ?? 0;
    this.x = bounds ? rubberbandClamp(e.clientX - this.grabX, bounds.left, bounds.right - w, bounds.width) : e.clientX - this.grabX;
    this.y = bounds ? rubberbandClamp(e.clientY - this.grabY, bounds.top, bounds.bottom - h, bounds.height) : e.clientY - this.grabY;
    this.paint();
    this.samples.push({ x: this.x, y: this.y, t: performance.now() });
    if (this.samples.length > 12) this.samples.shift();
    this.setHover(this.zoneAt(e.clientX, e.clientY));
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    if (this.phase === 'pending') {
      this.reset();
      return;
    }
    if (this.phase !== 'dragging') return;
    const { vx, vy } = releaseVelocity(this.samples);
    this.release(vx, vy, false, this.zoneAt(e.clientX, e.clientY));
  }

  private beginDrag(): void {
    const rect = this.host.getBoundingClientRect();
    const clone = this.host.cloneNode(true) as HTMLElement;
    clone.classList.remove('amx-pressed');
    clone.classList.add('amx-drag-preview');
    clone.removeAttribute('id');
    Object.assign(clone.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      zIndex: '2000',
      pointerEvents: 'none',
    });
    this.x = rect.left;
    this.y = rect.top;
    this.preview = clone;
    document.body.appendChild(clone);
    this.paint();
    this.host.classList.remove('amx-pressed');
    this.host.classList.add('amx-drag-origin');
    this.phase = 'dragging';
    this.samples = [{ x: this.x, y: this.y, t: performance.now() }];
    document.body.classList.add('amx-dragging');
  }

  /** Hands the gesture's velocity to a spring and animates to the chosen destination (or home). */
  private release(vx: number, vy: number, cancelled: boolean, under: HTMLElement | null = null): void {
    if (!this.preview) {
      this.reset();
      return;
    }
    const origin = this.host.closest<HTMLElement>('[data-drop-zone]');
    const flicked = !cancelled && Math.hypot(vx, vy) >= FLICK_MIN_SPEED;
    let zone: HTMLElement | null = null;
    if (!cancelled) {
      zone = flicked ? this.zoneNear(this.x + project(vx, DECELERATION), this.y + project(vy, DECELERATION)) : under;
    }
    const destination = zone && zone !== origin ? zone : null;
    const target = destination ? this.slotIn(destination) : this.homePosition();

    this.setHover(null);
    this.phase = 'settling';
    this.vx = cancelled ? 0 : vx;
    this.vy = cancelled ? 0 : vy;
    const done = () => this.finish(destination?.dataset['dropZone'] ?? null);

    if (this.reduceMotion()) {
      this.x = target.x;
      this.y = target.y;
      this.paint();
      done();
      return;
    }
    // Interruptible: while it flies, grabbing the card again re-enters the drag from its live position.
    this.preview.style.pointerEvents = 'auto';
    this.preview.addEventListener('pointerdown', this.regrab);
    // Under-damped (a little bounce) only when the gesture carried momentum; otherwise critically damped.
    const damping = flicked ? 0.82 : 1;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const sx = stepSpring({ position: this.x, velocity: this.vx }, target.x, dt, damping, 0.38);
      const sy = stepSpring({ position: this.y, velocity: this.vy }, target.y, dt, damping, 0.38);
      this.x = sx.position;
      this.vx = sx.velocity;
      this.y = sy.position;
      this.vy = sy.velocity;
      this.paint();
      if (isSettled(sx, target.x) && isSettled(sy, target.y)) {
        this.x = target.x;
        this.y = target.y;
        this.paint();
        done();
        return;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private readonly regrab = (e: PointerEvent) => {
    if (this.phase !== 'settling' || !this.preview) return;
    cancelAnimationFrame(this.raf);
    this.preview.removeEventListener('pointerdown', this.regrab);
    this.preview.style.pointerEvents = 'none';
    this.pointerId = e.pointerId;
    this.grabX = e.clientX - this.x;
    this.grabY = e.clientY - this.y;
    this.capture(this.preview, e.pointerId);
    this.samples = [{ x: this.x, y: this.y, t: performance.now() }];
    this.phase = 'dragging';
    e.preventDefault();
  };

  private finish(zoneId: string | null): void {
    const data = this.appFlickDrag();
    this.reset(false);
    if (zoneId !== null) {
      this.flickDrop.emit({ data, zone: zoneId });
    }
    // Remove the preview a frame later so the re-rendered card is already in place (no flicker).
    const preview = this.preview;
    this.preview = null;
    requestAnimationFrame(() => requestAnimationFrame(() => preview?.remove()));
    this.host.classList.remove('amx-drag-origin');
  }

  // --- geometry ------------------------------------------------------------------------------------

  private zones(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-drop-zone]'));
  }

  private zoneAt(px: number, py: number): HTMLElement | null {
    const el = document.elementFromPoint(px, py);
    return el?.closest<HTMLElement>('[data-drop-zone]') ?? null;
  }

  /** The zone closest to a projected point (distance to the zone's rectangle; 0 when inside). */
  private zoneNear(px: number, py: number): HTMLElement | null {
    const w = this.preview?.offsetWidth ?? 0;
    const h = this.preview?.offsetHeight ?? 0;
    const cx = px + w / 2;
    const cy = py + h / 2;
    let best: HTMLElement | null = null;
    let bestDistance = Infinity;
    for (const zone of this.zones()) {
      const r = zone.getBoundingClientRect();
      const dx = Math.max(r.left - cx, 0, cx - r.right);
      const dy = Math.max(r.top - cy, 0, cy - r.bottom);
      const d = Math.hypot(dx, dy);
      if (d < bestDistance) {
        bestDistance = d;
        best = zone;
      }
    }
    return best;
  }

  /** Where the card will sit in a zone: horizontally centred, below whatever is already there. */
  private slotIn(zone: HTMLElement): { x: number; y: number } {
    const r = zone.getBoundingClientRect();
    const w = this.preview?.offsetWidth ?? 0;
    const cards = Array.from(zone.children).filter((c) => !c.classList.contains('amx-drag-origin'));
    const last = cards[cards.length - 1] as HTMLElement | undefined;
    const top = last ? last.getBoundingClientRect().bottom + 8 : r.top + 8;
    return { x: r.left + (r.width - w) / 2, y: top };
  }

  private homePosition(): { x: number; y: number } {
    const r = this.host.getBoundingClientRect();
    return { x: r.left, y: r.top };
  }

  private bounds(): DOMRect | null {
    return this.host.closest<HTMLElement>('[data-drag-bounds]')?.getBoundingClientRect() ?? null;
  }

  // --- plumbing ------------------------------------------------------------------------------------

  private paint(): void {
    if (this.preview) {
      this.preview.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    }
  }

  private setHover(zone: HTMLElement | null): void {
    if (zone === this.hoverZone) return;
    this.hoverZone?.classList.remove('amx-drop-over');
    zone?.classList.add('amx-drop-over');
    this.hoverZone = zone;
  }

  private capture(el: HTMLElement, pointerId: number): void {
    try {
      el.setPointerCapture(pointerId);
      this.captureTarget = el;
    } catch {
      /* pointer already gone */
    }
  }

  private listen(): void {
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.cancel);
    window.addEventListener('keydown', this.key);
  }

  private unlisten(): void {
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.cancel);
    window.removeEventListener('keydown', this.key);
  }

  private reset(removePreview = true): void {
    cancelAnimationFrame(this.raf);
    this.unlisten();
    this.setHover(null);
    try {
      if (this.captureTarget && this.pointerId >= 0) this.captureTarget.releasePointerCapture(this.pointerId);
    } catch {
      /* already released */
    }
    this.captureTarget = null;
    this.host.classList.remove('amx-pressed');
    if (removePreview) {
      this.preview?.remove();
      this.preview = null;
      this.host.classList.remove('amx-drag-origin');
    }
    document.body.classList.remove('amx-dragging');
    this.phase = 'idle';
    this.pointerId = -1;
  }

  ngOnDestroy(): void {
    this.reset();
  }
}
