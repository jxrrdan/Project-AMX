import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { ListingPlatformType } from '@project-amx/shared';
import { environment } from '../../../environments/environment';

interface Platform {
  id: string;
  type: ListingPlatformType;
  enabled: boolean;
}

@Component({
  selector: 'app-listings-list',
  imports: [MatSlideToggleModule, MatCardModule],
  template: `
    <h1>Third-party Stock Listings</h1>
    <mat-card>
      @for (p of platforms(); track p.type) {
        <div class="row">
          <span>{{ p.type }}</span>
          <mat-slide-toggle [checked]="p.enabled" (change)="toggle(p)"></mat-slide-toggle>
        </div>
      }
    </mat-card>
  `,
  styles: [
    `
      mat-card {
        padding: 16px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #eee;
      }
    `,
  ],
})
export class ListingsListComponent implements OnInit {
  readonly platforms = signal<Platform[]>([]);
  private readonly allTypes = Object.values(ListingPlatformType);

  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.http.get<Platform[]>(`${environment.apiUrl}/listings/platforms`).subscribe((data) => {
      const byType = new Map(data.map((p) => [p.type, p]));
      this.platforms.set(this.allTypes.map((type) => byType.get(type) ?? { id: type, type, enabled: false }));
    });
  }

  toggle(platform: Platform): void {
    this.http
      .post(`${environment.apiUrl}/listings/platforms`, { type: platform.type, enabled: !platform.enabled })
      .subscribe(() => this.load());
  }
}
