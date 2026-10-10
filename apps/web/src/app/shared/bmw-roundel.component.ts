import { Component, input } from '@angular/core';

/**
 * The BMW roundel as inline SVG: black ring with the lettering, blue and white quadrants. Drawn
 * with plain geometry so it scales crisply and needs no image request. This is a stand-in for the
 * official artwork; swap in the asset from BMW's brand portal for any external use.
 */
@Component({
  selector: 'app-bmw-roundel',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 200 200" role="img" aria-label="BMW" focusable="false">
      <defs>
        <path id="roundel-arc" d="M 26 100 A 74 74 0 0 1 174 100" fill="none" />
      </defs>
      <circle cx="100" cy="100" r="98" fill="#1a1a1a" />
      <circle cx="100" cy="100" r="93" fill="none" stroke="#f2f2f2" stroke-width="1.5" />
      <circle cx="100" cy="100" r="64" fill="#fff" />
      <path d="M 100 100 L 100 36 A 64 64 0 0 0 36 100 Z" fill="#1c69d4" />
      <path d="M 100 100 L 164 100 A 64 64 0 0 1 100 164 Z" fill="#1c69d4" />
      <circle cx="100" cy="100" r="64" fill="none" stroke="#1a1a1a" stroke-width="2" />
      <text font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="25" fill="#fff" letter-spacing="9" text-anchor="middle">
        <textPath href="#roundel-arc" startOffset="50%">BMW</textPath>
      </text>
    </svg>
  `,
  styles: [':host { display: inline-flex; line-height: 0; }'],
})
export class BmwRoundelComponent {
  readonly size = input(36);
}
