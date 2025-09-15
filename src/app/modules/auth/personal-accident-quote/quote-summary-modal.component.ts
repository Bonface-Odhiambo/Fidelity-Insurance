import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { QuoteStorageService, PersonalAccidentQuote } from '../../../core/services/quote-storage.service';
import { ToastService } from '../../../core/services/toast.service';

export interface QuoteSummaryData {
  formData: any;
  coverOption: any;
  ageRange: string;
  calculatedPremium: number;
  benefits: any[];
  reference: string;
}

@Component({
  selector: 'app-quote-summary-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    CurrencyPipe
  ],
  template: `
    <div class="quote-summary-container">
      <div class="modal-header">
        <div class="header-icon-wrapper">
          <mat-icon>receipt_long</mat-icon>
        </div>
        <div>
          <h1 mat-dialog-title class="modal-title">Personal Accident Quote Summary</h1>
          <p class="modal-subtitle">Review your quote details before proceeding</p>
        </div>
        <button mat-icon-button (click)="closeDialog()" class="close-button" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content class="modal-content">
        <!-- Personal Details Section -->
        <div class="summary-section">
          <h3 class="section-title">
            <mat-icon>person</mat-icon>
            Personal Details
          </h3>
          <div class="details-grid">
            <div class="detail-item">
              <span class="label">Full Name:</span>
              <span class="value">{{ data.formData.personalDetails.firstName }} {{ data.formData.personalDetails.middleName }} {{ data.formData.personalDetails.surname }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Email:</span>
              <span class="value">{{ data.formData.personalDetails.email }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Mobile:</span>
              <span class="value">{{ data.formData.personalDetails.mobileNumber }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Age:</span>
              <span class="value">{{ data.formData.personalDetails.ageLastBirthday }} years</span>
            </div>
          </div>
        </div>

        <!-- Coverage Details Section -->
        <div class="summary-section">
          <h3 class="section-title">
            <mat-icon>shield</mat-icon>
            Coverage Details
          </h3>
          <div class="coverage-info">
            <div class="coverage-option">
              <span class="option-label">Selected Plan:</span>
              <span class="option-value">Option {{ data.coverOption.id }}</span>
            </div>
            <div class="coverage-option">
              <span class="option-label">Age Bracket:</span>
              <span class="option-value">{{ getAgeRangeLabel(data.ageRange) }}</span>
            </div>
          </div>

          <!-- Benefits Table -->
          <div class="benefits-table-container">
            <table class="benefits-table">
              <thead>
                <tr>
                  <th>Benefit</th>
                  <th>Coverage Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let benefit of data.benefits">
                  <td>{{ benefit.name }}</td>
                  <td>
                    <span *ngIf="data.coverOption[benefit.key] > 0">
                      {{ data.coverOption[benefit.key] | currency:'KES':'symbol':'1.0-0' }}
                    </span>
                    <span *ngIf="data.coverOption[benefit.key] === 0" class="not-covered">
                      Not Covered
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Premium Section -->
        <div class="summary-section">
          <div class="premium-display">
            <h3>Annual Premium</h3>
            <div class="amount">{{ data.calculatedPremium | currency:'KES':'symbol':'1.2-2' }}</div>
            <div class="period">Per Year</div>
            <div class="reference">Quote Reference: {{ data.reference }}</div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <button mat-stroked-button (click)="closeDialog()" class="btn-secondary">
            <mat-icon>edit</mat-icon>
            Edit Quote
          </button>
          <button mat-raised-button (click)="proceedToPayment()" class="btn-primary">
            <mat-icon>payment</mat-icon>
            Proceed to Payment
          </button>
        </div>
      </mat-dialog-content>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --brand-turquoise: #037B7C;
      --brand-lime: #B8D87A;
      --brand-dark-text: #1f2937;
      --white-color: #fff;
      --light-gray: #f8f9fa;
      --medium-gray: #e9ecef;
      --dark-gray: #495057;
    }

    .quote-summary-container {
      background-color: var(--white-color);
      border-radius: 16px;
      overflow: hidden;
      max-width: 600px;
      box-shadow: 0 10px 30px rgba(0,0,0,.1);
    }

    .modal-header {
      display: flex;
      align-items: center;
      padding: 20px 24px;
      background-color: var(--brand-turquoise);
      color: var(--white-color);
      position: relative;
    }

    .header-icon-wrapper {
      width: 48px;
      height: 48px;
      background-color: rgba(255,255,255,.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      flex-shrink: 0;
    }

    .header-icon-wrapper mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--brand-lime);
    }

    .modal-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      color: var(--white-color);
    }

    .modal-subtitle {
      font-size: 14px;
      opacity: .9;
      margin-top: 2px;
      color: var(--white-color);
    }

    .close-button {
      position: absolute;
      top: 12px;
      right: 12px;
      color: rgba(255,255,255,.7);
    }

    .close-button:hover {
      color: var(--white-color);
    }

    .modal-content {
      padding: 24px !important;
      background-color: var(--white-color);
      max-height: 70vh;
      overflow-y: auto;
    }

    .summary-section {
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--medium-gray);
    }

    .summary-section:last-of-type {
      border-bottom: none;
      margin-bottom: 0;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 600;
      color: var(--brand-turquoise);
      margin-bottom: 16px;
    }

    .details-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    @media (min-width: 480px) {
      .details-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .label {
      font-size: 12px;
      font-weight: 500;
      color: var(--dark-gray);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .value {
      font-size: 14px;
      font-weight: 600;
      color: var(--brand-dark-text);
    }

    .coverage-info {
      display: flex;
      gap: 24px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .coverage-option {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .option-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--dark-gray);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .option-value {
      font-size: 16px;
      font-weight: 700;
      color: var(--brand-turquoise);
    }

    .benefits-table-container {
      overflow-x: auto;
    }

    .benefits-table {
      width: 100%;
      border-collapse: collapse;
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .benefits-table th {
      background-color: var(--brand-turquoise);
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
    }

    .benefits-table td {
      padding: 12px;
      border-bottom: 1px solid var(--medium-gray);
      color: var(--brand-dark-text);
      font-size: 14px;
    }

    .benefits-table tr:last-child td {
      border-bottom: none;
    }

    .benefits-table tr:nth-child(even) {
      background-color: rgba(3, 123, 124, 0.02);
    }

    .not-covered {
      color: var(--dark-gray);
      font-style: italic;
    }

    .premium-display {
      background: linear-gradient(135deg, var(--brand-turquoise), var(--brand-lime));
      color: white;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(3, 123, 124, 0.3);
    }

    .premium-display h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 600;
      opacity: 0.9;
    }

    .premium-display .amount {
      font-size: 32px;
      font-weight: 700;
      margin: 8px 0;
    }

    .premium-display .period {
      font-size: 14px;
      opacity: 0.8;
      margin-bottom: 12px;
    }

    .premium-display .reference {
      font-size: 12px;
      opacity: 0.8;
      font-family: monospace;
      background-color: rgba(255,255,255,0.1);
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
    }

    .action-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
      flex-wrap: wrap;
    }

    .btn-primary, .btn-secondary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .btn-primary {
      background-color: var(--brand-turquoise);
      color: white;
      border: none;
    }

    .btn-primary:hover {
      background-color: var(--brand-lime);
      color: var(--brand-dark-text);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background-color: white;
      color: var(--brand-turquoise);
      border: 2px solid var(--brand-turquoise);
    }

    .btn-secondary:hover {
      background-color: var(--brand-turquoise);
      color: white;
    }

    @media (max-width: 480px) {
      .action-buttons {
        flex-direction: column;
      }

      .btn-primary, .btn-secondary {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class QuoteSummaryModalComponent implements OnInit {
  
  constructor(
    public dialogRef: MatDialogRef<QuoteSummaryModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QuoteSummaryData,
    private authService: AuthService,
    private quoteStorageService: QuoteStorageService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Save quote to localStorage when summary is shown
    this.saveQuoteToStorage();
  }

  getAgeRangeLabel(ageRangeId: string): string {
    const ageRanges = [
      { id: '19-40', label: 'Age 19 to 40' },
      { id: '41-70', label: 'Age 41 to 70' },
    ];
    return ageRanges.find(range => range.id === ageRangeId)?.label || ageRangeId;
  }

  private saveQuoteToStorage(): void {
    const quote: Omit<PersonalAccidentQuote, 'id' | 'timestamp'> = {
      userId: this.authService.currentUser?.id,
      formData: this.data.formData,
      coverOption: this.data.coverOption.id,
      ageRange: this.data.ageRange,
      calculatedPremium: this.data.calculatedPremium,
      status: 'quoted',
      reference: this.data.reference
    };

    this.quoteStorageService.saveQuote(quote);
  }

  proceedToPayment(): void {
    if (this.authService.isAuthenticated) {
      // User is logged in, close this modal and return payment data
      this.dialogRef.close({ 
        action: 'payment',
        quoteData: this.data 
      });
    } else {
      // User is not logged in, redirect to homepage with toast
      this.toastService.warning(
        'Login Required',
        'Please log in first to pay for your policy.'
      );
      
      this.dialogRef.close({ action: 'redirect' });
      this.router.navigate(['/']);
    }
  }

  closeDialog(): void {
    this.dialogRef.close({ action: 'edit' });
  }
}
