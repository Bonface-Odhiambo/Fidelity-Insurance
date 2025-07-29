import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';

export function maxWords(max: number) {
  return (control: AbstractControl): { [key: string]: any } | null => {
    if (!control.value) return null;
    const words = control.value.trim().split(/\s+/).length;
    return words > max ? { 'maxWords': { maxWords: max, actualWords: words } } : null;
  };
}

// --- Interfaces for Data Structures ---
interface PremiumCalculation { basePremium: number; phcf: number; trainingLevy: number; stampDuty: number; commission: number; totalPayable: number; currency: string; }
interface MarineProduct { code: string; name: string; rate: number; }
interface User { type: 'individual' | 'intermediary'; name: string; }
interface ImporterDetails { name: string; kraPin: string; }
interface MpesaPayment { amount: number; phoneNumber: string; reference: string; description: string; }
export interface PaymentResult { success: boolean; method: 'stk' | 'paybill' | 'card'; reference: string; mpesaReceipt?: string; }


// --- Embedded Payment Modal Component (Re-skinned for Fidelity) ---
@Component({
  selector: 'app-fidelity-payment-modal',
  standalone: true,
  imports: [ CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatProgressSpinnerModule, MatTabsModule ],
  //
  // UPDATED: New template with a proper header container
  //
  template: `
    <div class="modal-header">
      <h1 mat-dialog-title class="modal-title">Complete Your Payment</h1>
      <button mat-icon-button (click)="closeDialog()" class="close-button" aria-label="Close dialog"><mat-icon>close</mat-icon></button>
    </div>
    <mat-dialog-content class="modal-content">
      <p class="modal-subtitle">Pay KES {{ data.amount | number: '1.2-2' }} for {{ data.description }}</p>
      <mat-tab-group animationDuration="300ms" mat-stretch-tabs="true" class="payment-tabs">
        <mat-tab>
          <ng-template mat-tab-label><div class="tab-label-content"><mat-icon>phone_iphone</mat-icon><span>M-PESA</span></div></ng-template>
          <div class="tab-panel-content">
            <div class="sub-options">
              <button (click)="mpesaSubMethod = 'stk'" class="sub-option-btn" [class.active]="mpesaSubMethod === 'stk'"><mat-icon>tap_and_play</mat-icon><span>STK Push</span></button>
              <button (click)="mpesaSubMethod = 'paybill'" class="sub-option-btn" [class.active]="mpesaSubMethod === 'paybill'"><mat-icon>article</mat-icon><span>Use Paybill</span></button>
            </div>
            <div *ngIf="mpesaSubMethod === 'stk'" class="option-view animate-fade-in">
              <p class="instruction-text">Enter your M-PESA phone number to receive a payment prompt.</p>
              <form [formGroup]="stkForm">
                <mat-form-field appearance="outline"><mat-label>Phone Number</mat-label><input matInput formControlName="phoneNumber" placeholder="e.g., 0712345678" [disabled]="isProcessingStk"><mat-icon matSuffix>phone_iphone</mat-icon></mat-form-field>
              </form>
              <button mat-raised-button class="action-button" (click)="processStkPush()" [disabled]="stkForm.invalid || isProcessingStk"><mat-spinner *ngIf="isProcessingStk" diameter="24"></mat-spinner><span *ngIf="!isProcessingStk">Pay KES {{ data.amount | number: '1.0-0' }}</span></button>
            </div>
            <div *ngIf="mpesaSubMethod === 'paybill'" class="option-view animate-fade-in">
              <p class="instruction-text">Use the details below on your M-PESA App to complete payment.</p>
              <div class="paybill-details">
                <div class="detail-item"><span class="label">Paybill Number:</span><span class="value">853338</span></div>
                <div class="detail-item"><span class="label">Account Number:</span><span class="value account-number">{{ data.reference }}</span></div>
              </div>
              <button mat-raised-button class="action-button" (click)="verifyPaybillPayment()" [disabled]="isVerifyingPaybill"><mat-spinner *ngIf="isVerifyingPaybill" diameter="24"></mat-spinner><span *ngIf="!isVerifyingPaybill">Verify Payment</span></button>
            </div>
          </div>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label><div class="tab-label-content"><mat-icon>credit_card</mat-icon><span>Credit/Debit Card</span></div></ng-template>
          <div class="tab-panel-content animate-fade-in">
            <div class="card-redirect-info"><p class="instruction-text">You will be redirected to pay via our reliable and trusted payment partner.</p><button mat-raised-button class="action-button" (click)="redirectToCardGateway()" [disabled]="isRedirectingToCard"><mat-spinner *ngIf="isRedirectingToCard" diameter="24"></mat-spinner><span *ngIf="!isRedirectingToCard">Pay Using Credit/Debit Card</span></button></div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
  `,
  //
  // UPDATED: Styles for the new header structure
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
  `]
})
export class MpesaPaymentModalComponent {
    stkForm: FormGroup;
    selectedPaymentMethod: 'mpesa' | 'card' = 'mpesa';
    mpesaSubMethod: 'stk' | 'paybill' = 'stk';
    isProcessingStk = false; isVerifyingPaybill = false; isRedirectingToCard = false;
    constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<MpesaPaymentModalComponent>, @Inject(MAT_DIALOG_DATA) public data: MpesaPayment) { this.stkForm = this.fb.group({ phoneNumber: [data.phoneNumber || '', [Validators.required, Validators.pattern(/^(07|01)\d{8}$/)]], }); }
    closeDialog(result: PaymentResult | null = null): void { this.dialogRef.close(result); }
    processStkPush(): void { if (this.stkForm.invalid) return; this.isProcessingStk = true; setTimeout(() => { this.isProcessingStk = false; this.closeDialog({ success: true, method: 'stk', reference: this.data.reference, mpesaReceipt: 'S' + Math.random().toString(36).substring(2, 12).toUpperCase() }); }, 3000); }
    verifyPaybillPayment(): void { this.isVerifyingPaybill = true; setTimeout(() => { this.isVerifyingPaybill = false; this.closeDialog({ success: true, method: 'paybill', reference: this.data.reference }); }, 3500); }
    redirectToCardGateway(): void { this.isRedirectingToCard = true; setTimeout(() => { this.isRedirectingToCard = false; this.closeDialog({ success: true, method: 'card', reference: this.data.reference }); }, 2000); }
}

class AuthService { private _loggedIn = true; isLoggedIn(): boolean { return this._loggedIn; } setLoginStatus(status: boolean) { this._loggedIn = status; } }

@Component({
    selector: 'app-marine-cargo-quotation',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, CurrencyPipe, DecimalPipe, MatDialogModule, MpesaPaymentModalComponent],
    templateUrl: './marine-cargo-quotation.component.html',
    styleUrls: ['./marine-cargo-quotation.component.scss'],
})
export class MarineCargoQuotationComponent implements OnInit {
    quotationForm: FormGroup; clientDetailsForm: FormGroup; exportRequestForm: FormGroup; highRiskRequestForm: FormGroup;
    currentStep: number = 1; showExportModal: boolean = false; showHighRiskModal: boolean = false; toastMessage: string = ''; toastType: 'success' | 'info' | 'error' = 'success';
    currentUser: User = { type: 'individual', name: 'Individual User' }; importerDetails: ImporterDetails = { name: '', kraPin: '' };
    premiumCalculation: PremiumCalculation = this.resetPremiumCalculation();
    isLoggedIn: boolean = false;
    private authService = new AuthService();
    readonly marineProducts: MarineProduct[] = [{ code: 'ICC_A', name: 'Institute Cargo Clauses (A) - All Risks', rate: 0.005 }, { code: 'ICC_B', name: 'Institute Cargo Clauses (B) - Named Perils', rate: 0.0035 }, { code: 'ICC_C', name: 'Institute Cargo Clauses (C) - Limited Perils', rate: 0.0025 }];
    readonly marineCargoTypes: string[] = ['Pharmaceuticals', 'Electronics', 'Apparel', 'Vehicles', 'Machinery', 'General Goods'];
    readonly blacklistedCountries: string[] = ['Russia', 'Ukraine', 'North Korea', 'Syria', 'Iran', 'Yemen', 'Sudan', 'Somalia'];
    readonly allCountriesList: string[] = [ 'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'China', 'Denmark', 'Egypt', 'Finland', 'France', 'Germany', 'Ghana', 'Greece', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Kenya', 'Mexico', 'Netherlands', 'New Zealand', 'Nigeria', 'North Korea', 'Norway', 'Pakistan', 'Russia', 'Saudi Arabia', 'Somalia', 'South Africa', 'Spain', 'Sudan', 'Sweden', 'Switzerland', 'Syria', 'Tanzania', 'Turkey', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States of America', 'Yemen', 'Zambia', 'Zimbabwe'];
    private readonly TAX_RATES = { TRAINING_LEVY: 0.0025, STAMP_DUTY: 40, COMMISSION_RATE: 0.10 };

    constructor(private fb: FormBuilder, private router: Router, private dialog: MatDialog) {
        this.quotationForm = this.createQuotationForm(); this.clientDetailsForm = this.createClientDetailsForm();
        this.exportRequestForm = this.createExportRequestForm(); this.highRiskRequestForm = this.createHighRiskRequestForm();
    }
    ngOnInit(): void { this.isLoggedIn = this.authService.isLoggedIn(); this.setupFormSubscriptions(); this.setDefaultDate(); }
    private createQuotationForm(): FormGroup { return this.fb.group({ cargoType: ['', Validators.required], tradeType: ['import', Validators.required], modeOfShipment: ['', Validators.required], marineProduct: ['Institute Cargo Clauses (A) - All Risks', Validators.required], marineCargoType: ['', Validators.required], origin: ['', Validators.required], destination: [''], coverStartDate: ['', [Validators.required, this.noPastDatesValidator]], sumInsured: ['', [Validators.required, Validators.min(10000)]], descriptionOfGoods: ['', Validators.required], ucrNumber: ['', [Validators.required, Validators.pattern('^UCR\\d{7,}$')]], idfNumber: ['', [Validators.required, Validators.pattern('^E\\d{9,}$')]], }); }
    private createClientDetailsForm(): FormGroup { return this.fb.group({ idNumber: ['', Validators.required], kraPin: ['', Validators.required], firstName: ['', Validators.required], lastName: ['', Validators.required], email: ['', [Validators.required, Validators.email]], phoneNumber: ['', [Validators.required, Validators.pattern('^07[0-9]{8}$')]], termsAndConditions: [false, Validators.requiredTrue], dataPrivacyConsent: [false, Validators.requiredTrue], }); }
    private createModalForm(): FormGroup { return this.fb.group({ kraPin: ['', Validators.required], firstName: ['', Validators.required], lastName: ['', Validators.required], email: ['', [Validators.required, Validators.email]], phoneNumber: ['', [Validators.required, Validators.pattern('^07[0-9]{8}$')]], marineProduct: ['Institute Cargo Clauses (A) - All Risks', Validators.required], marineCargoType: ['', Validators.required], idfNumber: ['', Validators.required], ucrNumber: ['', Validators.required], originCountry: ['', Validators.required], destinationCountry: ['', Validators.required], shipmentDate: ['', [Validators.required, this.noPastDatesValidator]], goodsDescription: ['', [Validators.required, maxWords(100)]], termsAndConditions: [false, Validators.requiredTrue], dataPrivacyConsent: [false, Validators.requiredTrue], }); }
    private createExportRequestForm(): FormGroup { const form = this.createModalForm(); form.get('originCountry')?.patchValue('Kenya'); form.get('originCountry')?.disable(); return form; }
    private createHighRiskRequestForm(): FormGroup { return this.createModalForm(); }
    private setDefaultDate(): void { this.quotationForm.patchValue({ coverStartDate: this.getToday() }); }
    private setupFormSubscriptions(): void { this.quotationForm.get('modeOfShipment')?.valueChanges.subscribe(mode => { const destControl = this.quotationForm.get('destination'); if (mode === 'sea') { destControl?.setValue('Mombasa, Kenya'); } else if (mode === 'air') { destControl?.setValue('JKIA, Nairobi, Kenya'); } else { destControl?.setValue(''); } }); this.quotationForm.get('tradeType')?.valueChanges.subscribe(type => { if (type === 'export') { this.showExportModal = true; }}); this.quotationForm.get('origin')?.valueChanges.subscribe(country => { if (this.blacklistedCountries.includes(country)) { this.highRiskRequestForm.patchValue({ originCountry: country }); this.showHighRiskModal = true; } }); this.quotationForm.get('ucrNumber')?.valueChanges.subscribe(ucr => { if (this.quotationForm.get('ucrNumber')?.valid) { this.importerDetails = { name: 'Global Imports Ltd.', kraPin: 'P051234567X' }; } else { this.importerDetails = { name: '', kraPin: '' }; } }); }
    private calculatePremium(): void {
        const sumInsured = this.quotationForm.get('sumInsured')?.value || 0;
        const productValue = this.quotationForm.get('marineProduct')?.value;
        const selectedProduct = this.marineProducts.find(p => p.name === productValue);
        const rate = selectedProduct ? selectedProduct.rate : 0;
        const basePremium = sumInsured * rate;
        const { TRAINING_LEVY, STAMP_DUTY, COMMISSION_RATE } = this.TAX_RATES;
        const phcf = sumInsured * 0.05;
        const trainingLevy = basePremium * TRAINING_LEVY;
        const commission = this.currentUser.type === 'intermediary' ? basePremium * COMMISSION_RATE : 0;
        const totalPayable = basePremium + phcf + trainingLevy + STAMP_DUTY;
        this.premiumCalculation = { basePremium, phcf, trainingLevy, stampDuty: STAMP_DUTY, commission, totalPayable, currency: 'KES' };
    }
    private resetPremiumCalculation(): PremiumCalculation { return { basePremium: 0, phcf: 0, trainingLevy: 0, stampDuty: 0, commission: 0, totalPayable: 0, currency: 'KES' }; }
    onExportRequestSubmit(): void { if (this.exportRequestForm.valid) { this.closeAllModals(); this.showToast("Export request submitted. Our underwriter will contact you.", 'info'); } }
    onHighRiskRequestSubmit(): void { if (this.highRiskRequestForm.valid) { this.closeAllModals(); this.showToast("High-risk shipment request submitted for review.", 'info'); } }
    closeAllModals(): void { this.showExportModal = false; this.showHighRiskModal = false; this.quotationForm.get('tradeType')?.setValue('import', { emitEvent: false }); this.quotationForm.get('origin')?.setValue('', { emitEvent: false }); this.exportRequestForm.reset({ marineProduct: 'Institute Cargo Clauses (A) - All Risks', originCountry: 'Kenya' }); this.highRiskRequestForm.reset({ marineProduct: 'Institute Cargo Clauses (A) - All Risks' }); }
    private showToast(message: string, type: 'success' | 'info' | 'error' = 'success'): void { this.toastMessage = message; this.toastType = type; setTimeout(() => this.toastMessage = '', 5000); }
    onSubmit(): void { if (this.quotationForm.valid) { if (!this.showHighRiskModal && !this.showExportModal) { this.calculatePremium(); this.goToStep(2); } } else { this.quotationForm.markAllAsTouched(); } }
    downloadQuote(): void { if (this.clientDetailsForm.valid) { this.showToast('Quote download initiated successfully.'); } }
    handlePayment(): void { if (!this.clientDetailsForm.valid) { this.clientDetailsForm.markAllAsTouched(); return; } if (this.isLoggedIn) { this.openPaymentModal(); } else { this.router.navigate(['/']); } }
    private openPaymentModal(): void {
      const dialogRef = this.dialog.open(MpesaPaymentModalComponent, {
        data: {
          amount: this.premiumCalculation.totalPayable,
          phoneNumber: this.clientDetailsForm.get('phoneNumber')?.value,
          reference: `FID${Date.now()}`,
          description: 'Marine Insurance'
        }
      });
      dialogRef.afterClosed().subscribe((result: PaymentResult | null) => {
        if (result?.success) {
          this.showToast('Payment successful! Your certificate is ready.', 'success');
          setTimeout(() => this.downloadCertificate(), 1500);
        }
      });
    }
    downloadCertificate(): void { this.showToast("Your policy certificate has been downloaded.", 'success'); console.log("Certificate download process initiated."); setTimeout(() => this.closeForm(), 2000); }
    closeForm(): void { if (this.isLoggedIn) { this.router.navigate(['/dashboard']); } else { this.router.navigate(['/']); } }
    getToday(): string { return new Date().toISOString().split('T')[0]; }
    noPastDatesValidator(control: AbstractControl): { [key: string]: boolean } | null { if (!control.value) return null; return control.value < new Date().toISOString().split('T')[0] ? { pastDate: true } : null; }
    goToStep(step: number): void { this.currentStep = step; }
    switchUser(event: any): void { const userType = event.target.value as 'individual' | 'intermediary'; this.currentUser = { type: userType, name: userType === 'intermediary' ? 'Intermediary User' : 'Individual User' }; this.showToast(`Switched to ${this.currentUser.name} view.`, 'info'); if (this.currentStep === 2) { this.calculatePremium(); } }
}