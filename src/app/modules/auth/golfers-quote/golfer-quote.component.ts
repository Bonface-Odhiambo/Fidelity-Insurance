import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';

// --- Data Structures ---
interface CoverOption {
  id: 'A' | 'B' | 'C';
  name: string;
  premium: number;
  benefits: { name: string; limit: number; }[];
}
interface MpesaPayment { amount: number; phoneNumber: string; reference: string; description: string; }
export interface PaymentResult { success: boolean; }

// --- Reusable Payment Modal (Already branded) ---
@Component({
  selector: 'app-fidelity-payment-modal',
  standalone: true,
  imports: [ CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatProgressSpinnerModule, MatTabsModule ],
  template: `<div class="modal-header"><h1 mat-dialog-title class="modal-title">Complete Your Payment</h1><button mat-icon-button (click)="closeDialog()" class="close-button" aria-label="Close dialog"><mat-icon>close</mat-icon></button></div><mat-dialog-content class="modal-content"><p class="modal-subtitle">Pay KES {{ data.amount | number: '1.2-2' }} for {{ data.description }}</p><mat-tab-group animationDuration="300ms" mat-stretch-tabs="true" class="payment-tabs"><mat-tab><ng-template mat-tab-label><div class="tab-label-content"><mat-icon>phone_iphone</mat-icon><span>M-PESA</span></div></ng-template><div class="tab-panel-content"><div class="sub-options"><button (click)="mpesaSubMethod = 'stk'" class="sub-option-btn" [class.active]="mpesaSubMethod === 'stk'"><mat-icon>tap_and_play</mat-icon><span>STK Push</span></button><button (click)="mpesaSubMethod = 'paybill'" class="sub-option-btn" [class.active]="mpesaSubMethod === 'paybill'"><mat-icon>article</mat-icon><span>Use Paybill</span></button></div><div *ngIf="mpesaSubMethod === 'stk'" class="option-view animate-fade-in"><p class="instruction-text">Enter your M-PESA phone number to receive a payment prompt.</p><form [formGroup]="stkForm"><mat-form-field appearance="outline"><mat-label>Phone Number</mat-label><input matInput formControlName="phoneNumber" placeholder="e.g., 0712345678" [disabled]="isProcessingStk"><mat-icon matSuffix>phone_iphone</mat-icon></mat-form-field></form><button mat-raised-button class="action-button" (click)="processStkPush()" [disabled]="stkForm.invalid || isProcessingStk"><mat-spinner *ngIf="isProcessingStk" diameter="24"></mat-spinner><span *ngIf="!isProcessingStk">Pay KES {{ data.amount | number: '1.0-0' }}</span></button></div><div *ngIf="mpesaSubMethod === 'paybill'" class="option-view animate-fade-in"><p class="instruction-text">Use the details below on your M-PESA App to complete payment.</p><div class="paybill-details"><div class="detail-item"><span class="label">Paybill Number:</span><span class="value">853338</span></div><div class="detail-item"><span class="label">Account Number:</span><span class="value account-number">{{ data.reference }}</span></div></div><button mat-raised-button class="action-button" (click)="verifyPaybillPayment()" [disabled]="isVerifyingPaybill"><mat-spinner *ngIf="isVerifyingPaybill" diameter="24"></mat-spinner><span *ngIf="!isVerifyingPaybill">Verify Payment</span></button></div></div></mat-tab><mat-tab><ng-template mat-tab-label><div class="tab-label-content"><mat-icon>credit_card</mat-icon><span>Credit/Debit Card</span></div></ng-template><div class="tab-panel-content animate-fade-in"><div class="card-redirect-info"><p class="instruction-text">You will be redirected to pay via our reliable and trusted payment partner.</p><button mat-raised-button class="action-button" (click)="redirectToCardGateway()" [disabled]="isRedirectingToCard"><mat-spinner *ngIf="isRedirectingToCard" diameter="24"></mat-spinner><span *ngIf="!isRedirectingToCard">Pay Using Credit/Debit Card</span></button></div></div></mat-tab></mat-tab-group></mat-dialog-content>`,
  //
  // FIX: Replaced the invalid HTML comment with the correct CSS styles.
  //
  styles: [`
    :host {
      --fidelity-turquoise: #037B7C;
      --fidelity-lime: #B8D87A;
      --fidelity-white: #ffffff;
      --light-gray: #f8f9fa;
      --medium-gray: #e9ecef;
      --dark-gray: #495057;
      --dark-text: #1f2937;
    }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 12px 24px; background-color: var(--fidelity-turquoise); color: var(--fidelity-white); }
    .modal-title { font-size: 20px; font-weight: 600; margin: 0; color: var(--fidelity-white); }
    .close-button { color: var(--fidelity-white); }
    .modal-content { padding: 24px !important; }
    .modal-subtitle { font-size: 14px; color: var(--dark-gray); margin-bottom: 20px; text-align: center; }
    .payment-tabs .tab-label-content { display: flex; align-items: center; gap: 8px; height: 60px; }
    .tab-panel-content { padding-top: 24px; }
    .sub-options { display: flex; gap: 12px; margin-bottom: 24px; border: 1px solid var(--medium-gray); border-radius: 12px; padding: 6px; background-color: var(--light-gray); }
    .sub-option-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 8px; border: none; background-color: transparent; font-weight: 600; cursor: pointer; transition: all 0.2s; color: var(--dark-gray); }
    .sub-option-btn.active { background-color: var(--fidelity-turquoise); color: var(--fidelity-white); }
    .instruction-text { text-align: center; color: var(--dark-gray); font-size: 15px; margin-bottom: 20px; }
    mat-form-field { width: 100%; }
    .action-button { width: 100%; height: 52px; border-radius: 12px; background-color: var(--fidelity-turquoise) !important; color: var(--fidelity-white) !important; font-size: 16px; font-weight: 700; transition: all 0.3s ease; }
    .action-button:hover:not(:disabled) { background-color: var(--fidelity-lime) !important; color: var(--dark-text) !important; transform: translateY(-2px); }
    .action-button:disabled { background-color: #a0a3c2 !important; color: rgba(255, 255, 255, 0.7) !important; cursor: not-allowed; }
    .paybill-details { background: var(--light-gray); border: 1px dashed var(--medium-gray); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .detail-item { display: flex; justify-content: space-between; align-items: center; font-size: 16px; padding: 12px 0; }
    .detail-item + .detail-item { border-top: 1px solid var(--medium-gray); }
    .detail-item .label { color: var(--dark-gray); }
    .detail-item .value { font-weight: 700; }
    .detail-item .account-number { font-family: 'Courier New', monospace; background-color: var(--medium-gray); padding: 4px 8px; border-radius: 6px; }
    .card-redirect-info { text-align: center; }
    .animate-fade-in { animation: fadeIn 0.4s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    ::ng-deep .payment-tabs .mat-mdc-tab-header { --mat-tab-header-inactive-ripple-color: rgba(3, 123, 124, 0.1); --mat-tab-header-active-ripple-color: rgba(3, 123, 124, 0.2); }
    ::ng-deep .payment-tabs .mdc-tab__text-label { color: var(--dark-gray); font-weight: 600; }
    ::ng-deep .payment-tabs .mat-mdc-tab.mat-mdc-tab-active .mdc-tab__text-label { color: var(--fidelity-turquoise); }
    ::ng-deep .payment-tabs .mat-mdc-tab-indicator-bar { background-color: var(--fidelity-turquoise) !important; }
  `],
})
export class MpesaPaymentModalComponent {
    stkForm: FormGroup;
    selectedPaymentMethod: 'mpesa' | 'card' = 'mpesa';
    mpesaSubMethod: 'stk' | 'paybill' = 'stk';
    isProcessingStk = false; isVerifyingPaybill = false; isRedirectingToCard = false;
    constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<MpesaPaymentModalComponent>, @Inject(MAT_DIALOG_DATA) public data: MpesaPayment) { this.stkForm = this.fb.group({ phoneNumber: [data.phoneNumber || '', [Validators.required, Validators.pattern(/^(07|01)\d{8}$/)]], }); }
    closeDialog(result: PaymentResult | null = null): void { this.dialogRef.close(result); }
    processStkPush(): void { if (this.stkForm.invalid) return; this.isProcessingStk = true; setTimeout(() => { this.isProcessingStk = false; this.closeDialog({ success: true }); }, 3000); }
    verifyPaybillPayment(): void { this.isVerifyingPaybill = true; setTimeout(() => { this.isVerifyingPaybill = false; this.closeDialog({ success: true }); }, 3500); }
    redirectToCardGateway(): void { this.isRedirectingToCard = true; setTimeout(() => { this.isRedirectingToCard = false; this.closeDialog({ success: true }); }, 2000); }
}


@Component({
  selector: 'app-golfers-quote',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MpesaPaymentModalComponent, MatIconModule],
  templateUrl: './golfers-quote.component.html',
  styleUrls: ['./golfers-quote.component.scss']
})
export class GolfersQuoteComponent implements OnInit {
  golferForm: FormGroup;
  selectedPlan: CoverOption | null = null;
  
  readonly coverOptions: CoverOption[] = [
    {
      id: 'A',
      name: 'Option A',
      premium: 5000,
      benefits: [
        { name: 'Golf Equipment', limit: 100000 },
        { name: 'Personal Effects', limit: 10000 },
        { name: 'Legal Liability', limit: 1000000 },
        { name: 'Personal Accident', limit: 250000 },
        { name: 'Hole in One', limit: 30000 },
      ],
    },
    {
      id: 'B',
      name: 'Option B',
      premium: 7500,
      benefits: [
        { name: 'Golf Equipment', limit: 150000 },
        { name: 'Personal Effects', limit: 10000 },
        { name: 'Legal Liability', limit: 1000000 },
        { name: 'Personal Accident', limit: 250000 },
        { name: 'Hole in One', limit: 40000 },
      ],
    },
    {
      id: 'C',
      name: 'Option C',
      premium: 10000,
      benefits: [
        { name: 'Golf Equipment', limit: 200000 },
        { name: 'Personal Effects', limit: 10000 },
        { name: 'Legal Liability', limit: 1000000 },
        { name: 'Personal Accident', limit: 250000 },
        { name: 'Hole in One', limit: 50000 },
      ],
    },
  ];

  constructor(private fb: FormBuilder, private router: Router, private dialog: MatDialog) {
    this.golferForm = this.fb.group({
      fullName: ['', Validators.required],
      dob: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern('^07[0-9]{8}$')]],
      kraPin: [''],
      golfClub: ['', Validators.required],
      coverOption: ['A', Validators.required],
      termsAndConditions: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    this.onPlanChange();
    this.golferForm.get('coverOption')?.valueChanges.subscribe(() => {
      this.onPlanChange();
    });
  }
  
  onPlanChange(): void {
    const selectedId = this.golferForm.get('coverOption')?.value;
    this.selectedPlan = this.coverOptions.find(p => p.id === selectedId) || null;
  }
  
  handlePayment(): void {
    if (this.golferForm.invalid || !this.selectedPlan) return;
    
    const dialogRef = this.dialog.open(MpesaPaymentModalComponent, {
      data: {
        amount: this.selectedPlan.premium,
        phoneNumber: this.golferForm.get('phoneNumber')?.value,
        reference: `FID-GLF-${Date.now()}`,
        description: `Golfers Insurance - ${this.selectedPlan.name}`
      }
    });

    dialogRef.afterClosed().subscribe((result: PaymentResult | null) => {
      if (result?.success) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  closeForm(): void {
    this.router.navigate(['/dashboard']);
  }
}