import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';

// --- Data Structures ---
interface TravelPlan { id: string; name: string; description: string; benefits: Benefit[]; }
interface Benefit { name: string; limit: string; }
interface Premium { baseRate: number; subtotal: number; groupDiscount: number; ageSurcharge: number; winterSportsSurcharge: number; totalPayable: number; durationDays: number; }
interface MpesaPayment { amount: number; phoneNumber: string; reference: string; description: string; }
export interface PaymentResult { success: boolean; }

// --- Reusable Payment Modal (Already branded) ---
@Component({
  selector: 'app-fidelity-payment-modal',
  standalone: true,
  imports: [ CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatProgressSpinnerModule, MatTabsModule ],
  template: `<div class="modal-header"><h1 mat-dialog-title class="modal-title">Complete Your Payment</h1><button mat-icon-button (click)="closeDialog()" class="close-button" aria-label="Close dialog"><mat-icon>close</mat-icon></button></div><mat-dialog-content class="modal-content"><p class="modal-subtitle">Pay KES {{ data.amount | number: '1.2-2' }} for {{ data.description }}</p><mat-tab-group animationDuration="300ms" mat-stretch-tabs="true" class="payment-tabs"><mat-tab><ng-template mat-tab-label><div class="tab-label-content"><mat-icon>phone_iphone</mat-icon><span>M-PESA</span></div></ng-template><div class="tab-panel-content"><div class="sub-options"><button (click)="mpesaSubMethod = 'stk'" class="sub-option-btn" [class.active]="mpesaSubMethod === 'stk'"><mat-icon>tap_and_play</mat-icon><span>STK Push</span></button><button (click)="mpesaSubMethod = 'paybill'" class="sub-option-btn" [class.active]="mpesaSubMethod === 'paybill'"><mat-icon>article</mat-icon><span>Use Paybill</span></button></div><div *ngIf="mpesaSubMethod === 'stk'" class="option-view animate-fade-in"><p class="instruction-text">Enter your M-PESA phone number to receive a payment prompt.</p><form [formGroup]="stkForm"><mat-form-field appearance="outline"><mat-label>Phone Number</mat-label><input matInput formControlName="phoneNumber" placeholder="e.g., 0712345678" [disabled]="isProcessingStk"><mat-icon matSuffix>phone_iphone</mat-icon></mat-form-field></form><button mat-raised-button class="action-button" (click)="processStkPush()" [disabled]="stkForm.invalid || isProcessingStk"><mat-spinner *ngIf="isProcessingStk" diameter="24"></mat-spinner><span *ngIf="!isProcessingStk">Pay KES {{ data.amount | number: '1.0-0' }}</span></button></div><div *ngIf="mpesaSubMethod === 'paybill'" class="option-view animate-fade-in"><p class="instruction-text">Use the details below on your M-PESA App to complete payment.</p><div class="paybill-details"><div class="detail-item"><span class="label">Paybill Number:</span><span class="value">853338</span></div><div class="detail-item"><span class="label">Account Number:</span><span class="value account-number">{{ data.reference }}</span></div></div><button mat-raised-button class="action-button" (click)="verifyPaybillPayment()" [disabled]="isVerifyingPaybill"><mat-spinner *ngIf="isVerifyingPaybill" diameter="24"></mat-spinner><span *ngIf="!isVerifyingPaybill">Verify Payment</span></button></div></div></mat-tab><mat-tab><ng-template mat-tab-label><div class="tab-label-content"><mat-icon>credit_card</mat-icon><span>Credit/Debit Card</span></div></ng-template><div class="tab-panel-content animate-fade-in"><div class="card-redirect-info"><p class="instruction-text">You will be redirected to pay via our reliable and trusted payment partner.</p><button mat-raised-button class="action-button" (click)="redirectToCardGateway()" [disabled]="isRedirectingToCard"><mat-spinner *ngIf="isRedirectingToCard" diameter="24"></mat-spinner><span *ngIf="!isRedirectingToCard">Pay Using Credit/Debit Card</span></button></div></div></mat-tab></mat-tab-group></mat-dialog-content>`,
  styles: [`:host { --fidelity-turquoise: #037B7C; --fidelity-lime: #B8D87A; --fidelity-white: #ffffff; --light-gray: #f8f9fa; --medium-gray: #e9ecef; --dark-gray: #495057; --dark-text: #1f2937; } .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 12px 24px; background-color: var(--fidelity-turquoise); color: var(--fidelity-white); } .modal-title { font-size: 20px; font-weight: 600; margin: 0; color: var(--fidelity-white); } .close-button { color: var(--fidelity-white); } .modal-content { padding: 24px !important; } .modal-subtitle { font-size: 14px; color: var(--dark-gray); margin-bottom: 20px; text-align: center; } .payment-tabs .tab-label-content { display: flex; align-items: center; gap: 8px; height: 60px; } .tab-panel-content { padding-top: 24px; } .sub-options { display: flex; gap: 12px; margin-bottom: 24px; border: 1px solid var(--medium-gray); border-radius: 12px; padding: 6px; background-color: var(--light-gray); } .sub-option-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 8px; border: none; background-color: transparent; font-weight: 600; cursor: pointer; transition: all 0.2s; color: var(--dark-gray); } .sub-option-btn.active { background-color: var(--fidelity-turquoise); color: var(--fidelity-white); } .instruction-text { text-align: center; color: var(--dark-gray); font-size: 15px; margin-bottom: 20px; } mat-form-field { width: 100%; } .action-button { width: 100%; height: 52px; border-radius: 12px; background-color: var(--fidelity-turquoise) !important; color: var(--fidelity-white) !important; font-size: 16px; font-weight: 700; transition: all 0.3s ease; } .action-button:hover:not(:disabled) { background-color: var(--fidelity-lime) !important; color: var(--dark-text) !important; transform: translateY(-2px); } .action-button:disabled { background-color: #a0a3c2 !important; color: rgba(255, 255, 255, 0.7) !important; cursor: not-allowed; } .paybill-details { background: var(--light-gray); border: 1px dashed var(--medium-gray); border-radius: 12px; padding: 20px; margin-bottom: 24px; } .detail-item { display: flex; justify-content: space-between; align-items: center; font-size: 16px; padding: 12px 0; } .detail-item + .detail-item { border-top: 1px solid var(--medium-gray); } .detail-item .label { color: var(--dark-gray); } .detail-item .value { font-weight: 700; } .detail-item .account-number { font-family: 'Courier New', monospace; background-color: var(--medium-gray); padding: 4px 8px; border-radius: 6px; } .card-redirect-info { text-align: center; } .animate-fade-in { animation: fadeIn 0.4s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } ::ng-deep .payment-tabs .mat-mdc-tab-header { --mat-tab-header-inactive-ripple-color: rgba(3, 123, 124, 0.1); --mat-tab-header-active-ripple-color: rgba(3, 123, 124, 0.2); } ::ng-deep .payment-tabs .mdc-tab__text-label { color: var(--dark-gray); font-weight: 600; } ::ng-deep .payment-tabs .mat-mdc-tab.mat-mdc-tab-active .mdc-tab__text-label { color: var(--fidelity-turquoise); } ::ng-deep .payment-tabs .mat-mdc-tab-indicator-bar { background-color: var(--fidelity-turquoise) !important; } `]
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
  selector: 'app-travel-quote',
  standalone: true,
  imports: [ CommonModule, ReactiveFormsModule, MatDialogModule, MpesaPaymentModalComponent, MatIconModule ],
  templateUrl: './travel-quote.component.html',
  styleUrls: ['./travel-quote.component.scss'],
})
export class TravelQuoteComponent implements OnInit {
  currentStep: number = 1;
  quotationForm: FormGroup;
  travelerDetailsForm: FormGroup;
  destinationRegions = ['Africa', 'Asia', 'Europe', 'Worldwide'];
  premium: Premium = this.resetPremium();
  selectedPlanDetails: TravelPlan | null = null;
  
  travelPlans: Omit<TravelPlan, 'benefits'>[] = [
    { id: 'AFRICA', name: 'Africa/Asia', description: 'Value cover for travels within Africa or Asia.' },
    { id: 'EUROPE', name: 'Europe Basic', description: 'Essential cover for Europe.' },
    { id: 'BASIC', name: 'Worldwide Basic', description: 'Basic cover for global travel.' },
    { id: 'PLUS', name: 'Worldwide Plus', description: 'Enhanced worldwide insurance.' },
    { id: 'EXTRA', name: 'Worldwide Extra', description: 'Ultimate protection while travelling.' },
  ];

  private rates: { [duration: string]: { [plan: string]: number } } = {
    '4': { AFRICA: 12, ASIA: 14, EUROPE: 15, BASIC: 20, PLUS: 27, EXTRA: 34 },
    '9': { AFRICA: 12, ASIA: 14, EUROPE: 15, BASIC: 20, PLUS: 27, EXTRA: 34 },
    '15': { AFRICA: 17, ASIA: 19, EUROPE: 22, BASIC: 28, PLUS: 51, EXTRA: 62 },
    '25': { AFRICA: 20, ASIA: 25, EUROPE: 30, BASIC: 35, PLUS: 55, EXTRA: 67 },
    '32': { AFRICA: 25, ASIA: 28, EUROPE: 32, BASIC: 38, PLUS: 72, EXTRA: 81 },
    '38': { AFRICA: 32, ASIA: 33, EUROPE: 38, BASIC: 48, PLUS: 90, EXTRA: 111 },
    '62': { AFRICA: 50, ASIA: 52, EUROPE: 57, BASIC: 70, PLUS: 98, EXTRA: 165 },
    '92': { AFRICA: 59, ASIA: 59, EUROPE: 74, BASIC: 98, PLUS: 138, EXTRA: 179 },
    '185': { AFRICA: 70, ASIA: 70, EUROPE: 80, BASIC: 106, PLUS: 193, EXTRA: 240 },
    '365': { AFRICA: 82, ASIA: 90, EUROPE: 103, BASIC: 136, PLUS: 248, EXTRA: 295 },
  };

  constructor(private fb: FormBuilder, private router: Router, private dialog: MatDialog) {
    this.quotationForm = this.fb.group({
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      numTravelers: [1, [Validators.required, Validators.min(1)]],
      destination: ['Africa', Validators.required],
      plan: ['AFRICA', Validators.required],
      winterSports: [false]
    }, { validators: this.dateRangeValidator });

    this.travelerDetailsForm = this.fb.group({
      fullName: ['', Validators.required],
      dob: ['', Validators.required],
      passportNo: [''],
      kraPin: [''],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', Validators.required],
      termsAndConditions: [false, Validators.requiredTrue],
      dataPrivacyConsent: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    this.quotationForm.valueChanges.subscribe(() => { if (this.quotationForm.valid) { this.calculatePremium(); } else { this.premium = this.resetPremium(); }});
    this.travelerDetailsForm.get('dob')?.valueChanges.subscribe(() => this.calculatePremium());
  }

  calculatePremium(): void {
    if (!this.quotationForm.valid) return;
    const values = this.quotationForm.value;
    const diffTime = Math.abs(new Date(values.endDate).getTime() - new Date(values.startDate).getTime());
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const durationTier = this.getDurationTier(durationDays);
    if (!durationTier) { this.premium = this.resetPremium(); return; }

    const baseRate = this.rates[durationTier][values.plan] || 0;
    const subtotal = baseRate * values.numTravelers;

    let groupDiscount = 0;
    if (values.numTravelers >= 201) groupDiscount = subtotal * 0.25;
    else if (values.numTravelers >= 101) groupDiscount = subtotal * 0.20;
    else if (values.numTravelers >= 51) groupDiscount = subtotal * 0.15;
    else if (values.numTravelers >= 21) groupDiscount = subtotal * 0.10;
    else if (values.numTravelers >= 10) groupDiscount = subtotal * 0.05;

    let ageSurcharge = 0;
    const dob = this.travelerDetailsForm.get('dob')?.value;
    if (dob) {
        const age = new Date().getFullYear() - new Date(dob).getFullYear();
        if (age >= 76) ageSurcharge = subtotal * 2;
        else if (age >= 66) ageSurcharge = subtotal * 1;
    }
    
    const winterSportsSurcharge = values.winterSports ? subtotal : 0;
    const totalPayable = subtotal - groupDiscount + ageSurcharge + winterSportsSurcharge;
    this.premium = { baseRate, subtotal, groupDiscount, ageSurcharge, winterSportsSurcharge, totalPayable, durationDays };
    
    this.selectedPlanDetails = this.getFullPlanDetails(values.plan);
  }

  nextStep(): void { if (!this.isCurrentStepInvalid()) this.currentStep++; }
  prevStep(): void { if (this.currentStep > 1) this.currentStep--; }

  isCurrentStepInvalid(): boolean {
    if (this.currentStep === 1) return this.quotationForm.invalid;
    if (this.currentStep === 2) return this.travelerDetailsForm.invalid;
    return false;
  }
  
  handlePayment(): void {
    if (this.travelerDetailsForm.invalid) return;
    const dialogRef = this.dialog.open(MpesaPaymentModalComponent, {
      data: {
        amount: this.premium.totalPayable,
        phoneNumber: this.travelerDetailsForm.get('phoneNumber')?.value,
        reference: `FID-TRV-${Date.now()}`,
        description: `${this.getPlanName(this.quotationForm.value.plan)} Cover`
      }
    });
    dialogRef.afterClosed().subscribe((result: PaymentResult | null) => { if (result?.success) { this.router.navigate(['/dashboard']); }});
  }

  private getDurationTier(days: number): string | null {
    if (days <= 9) return '9'; if (days <= 15) return '15'; if (days <= 25) return '25'; if (days <= 32) return '32'; if (days <= 38) return '38';
    if (days <= 62) return '62'; if (days <= 92) return '92'; if (days <= 185) return '185'; if (days <= 365) return '365';
    return null;
  }
  
  getToday(): string { return new Date().toISOString().split('T')[0]; }
  dateRangeValidator(group: AbstractControl): { [key: string]: boolean } | null { const start = group.get('startDate')?.value; const end = group.get('endDate')?.value; return start && end && start > end ? { invalidDateRange: true } : null; }
  getPlanName(planId: string): string { return this.travelPlans.find(p => p.id === planId)?.name || 'Unknown Plan'; }
  closeForm(): void { this.router.navigate(['/dashboard']); }
  
  //
  // FIX: Converted from an arrow function to a regular method to solve the initialization error.
  //
  private resetPremium(): Premium {
    return { baseRate: 0, subtotal: 0, groupDiscount: 0, ageSurcharge: 0, winterSportsSurcharge: 0, totalPayable: 0, durationDays: 0 };
  }
  
  private getFullPlanDetails(planId: string): TravelPlan | null {
    const planInfo = this.travelPlans.find(p => p.id === planId);
    if (!planInfo) return null;

    if (planId === 'PLUS') {
      return {
        ...planInfo,
        benefits: [
          { name: 'Emergency Medical expenses', limit: '$140,000' },
          { name: 'Excess (Medical)', limit: '$130' },
          { name: 'Repatriation', limit: '$25,000' },
          { name: 'Baggage Loss/Delay', limit: '$2,000' },
          { name: 'Personal Liability', limit: '$150,000' },
          { name: 'Cancellation or Curtailment', limit: '$2,000' },
        ]
      };
    }
    return { ...planInfo, benefits: [ {name: 'Standard Coverage', limit: 'Varies by plan'} ]};
  }
}