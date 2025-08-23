import { CommonModule, CurrencyPipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, StoredUser, PendingQuote, ImporterDetails } from '../shared/services/auth.service';

// --- INTERFACES & VALIDATORS ---
export function maxWords(max: number) { return (control: AbstractControl): { [key: string]: any } | null => { if (!control.value) return null; const words = control.value.trim().split(/\s+/).length; return words > max ? { maxWords: { maxWords: max, actualWords: words } } : null; }; }
interface PremiumCalculation { basePremium: number; phcf: number; trainingLevy: number; stampDuty: number; commission: number; totalPayable: number; currency: string; }
interface MarineProduct { code: string; name: string; rate: number; }
interface MpesaPayment { amount: number; phoneNumber: string; reference: string; description: string; }
export interface PaymentResult { success: boolean; method: 'stk' | 'paybill' | 'card'; reference: string; mpesaReceipt?: string; }
interface DisplayUser { type: 'individual' | 'intermediary'; name: string; }


// --- PAYMENT MODAL COMPONENT ---
@Component({ 
    selector: 'app-payment-modal', 
    standalone: true, 
    imports: [ CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatProgressSpinnerModule, MatTabsModule ], 
    template: `
        <div class="payment-modal-container">
            <div class="modal-header">
                <div class="header-icon-wrapper"><mat-icon>payment</mat-icon></div>
                <div>
                    <h1 mat-dialog-title class="modal-title">Complete Your Payment</h1>
                    <p class="modal-subtitle">Pay KES {{ data.amount | number: '1.2-2' }} for {{ data.description }}</p>
                </div>
                <button mat-icon-button (click)="closeDialog()" class="close-button" aria-label="Close dialog"><mat-icon>close</mat-icon></button>
            </div>
            <mat-dialog-content class="modal-content">
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
                                    <mat-form-field appearance="outline">
                                        <mat-label>Phone Number</mat-label>
                                        <input matInput formControlName="phoneNumber" placeholder="e.g., 0712345678" [disabled]="isProcessingStk"/>
                                        <mat-icon matSuffix>phone_iphone</mat-icon>
                                    </mat-form-field>
                                </form>
                                <button mat-raised-button class="action-button" (click)="processStkPush()" [disabled]="stkForm.invalid || isProcessingStk">
                                    <mat-spinner *ngIf="isProcessingStk" diameter="24"></mat-spinner>
                                    <span *ngIf="!isProcessingStk">Pay KES {{ data.amount | number: '1.2-2' }}</span>
                                </button>
                            </div>
                            <div *ngIf="mpesaSubMethod === 'paybill'" class="option-view animate-fade-in">
                                <p class="instruction-text">Use the details below on your M-PESA App to complete payment.</p>
                                <div class="paybill-details"><div class="detail-item"><span class="label">Paybill Number:</span><span class="value">853338</span></div><div class="detail-item"><span class="label">Account Number:</span><span class="value account-number">{{ data.reference }}</span></div></div>
                                <button mat-raised-button class="action-button" (click)="verifyPaybillPayment()" [disabled]="isVerifyingPaybill"><mat-spinner *ngIf="isVerifyingPaybill" diameter="24"></mat-spinner><span *ngIf="!isVerifyingPaybill">Verify Payment</span></button>
                            </div>
                        </div>
                    </mat-tab>
                    <mat-tab>
                        <ng-template mat-tab-label><div class="tab-label-content"><mat-icon>credit_card</mat-icon><span>Credit/Debit Card</span></div></ng-template>
                        <div class="tab-panel-content animate-fade-in"><div class="card-redirect-info"><p class="instruction-text">You will be redirected to a secure payment gateway to complete your transaction.</p><button mat-raised-button class="action-button" (click)="redirectToCardGateway()" [disabled]="isRedirectingToCard"><mat-spinner *ngIf="isRedirectingToCard" diameter="24"></mat-spinner><span *ngIf="!isRedirectingToCard">Pay Using Card</span></button></div></div>
                    </mat-tab>
                </mat-tab-group>
            </mat-dialog-content>
        </div>
    `, 
    styles: [`:host { display: block; --brand-turquoise: #037B7C; --brand-lime: #B8D87A; --brand-dark-text: #1f2937; --white-color: #fff; --light-gray: #f8f9fa; --medium-gray: #e9ecef; --dark-gray: #495057; } .payment-modal-container { background-color: var(--white-color); border-radius: 16px; overflow: hidden; max-width: 450px; box-shadow: 0 10px 30px rgba(0,0,0,.1); } .modal-header { display: flex; align-items: center; padding: 20px 24px; background-color: var(--brand-turquoise); color: var(--white-color); position: relative; } .header-icon-wrapper { width: 48px; height: 48px; background-color: rgba(255,255,255,.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 16px; flex-shrink: 0; } .header-icon-wrapper mat-icon { font-size: 28px; width: 28px; height: 28px; color: var(--brand-lime); } .modal-title { font-size: 20px; font-weight: 600; margin: 0; color: var(--white-color); } .modal-subtitle { font-size: 14px; opacity: .9; margin-top: 2px; color: var(--white-color); } .close-button { position: absolute; top: 12px; right: 12px; color: rgba(255,255,255,.7); } .close-button:hover { color: var(--white-color); } .modal-content { padding: 0 !important; background-color: var(--white-color); } .tab-panel-content { padding: 24px; } .sub-options { display: flex; gap: 8px; margin-bottom: 24px; border: 1px solid var(--medium-gray); border-radius: 12px; padding: 6px; background-color: var(--light-gray); } .sub-option-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-radius: 8px; border: none; background-color: transparent; font-weight: 500; cursor: pointer; transition: all .3s ease; color: var(--dark-gray); } .sub-option-btn.active { background-color: var(--white-color); color: var(--brand-turquoise); box-shadow: 0 2px 4px rgba(0,0,0,.05); } .instruction-text { text-align: center; color: var(--dark-gray); font-size: 14px; margin-bottom: 20px; line-height: 1.5; } mat-form-field { width: 100%; } .action-button { width: 100%; height: 50px; border-radius: 9999px !important; background-color: var(--brand-turquoise) !important; color: var(--white-color) !important; font-size: 16px; font-weight: 600; } .action-button:hover:not(:disabled) { background-color: var(--brand-lime) !important; color: var(--brand-dark-text) !important; } .action-button:disabled { background-color: #a0a3c2 !important; } .paybill-details { background: var(--light-gray); border: 1px dashed #d1d5db; border-radius: 12px; padding: 20px; margin-bottom: 24px; } .detail-item { display: flex; justify-content: space-between; align-items: center; font-size: 16px; padding: 12px 0; } .detail-item + .detail-item { border-top: 1px solid var(--medium-gray); } .detail-item .label { color: var(--dark-gray); } .detail-item .value { font-weight: 700; color: var(--brand-turquoise); } .detail-item .account-number { font-family: 'Courier New', monospace; background-color: var(--medium-gray); padding: 4px 8px; border-radius: 6px; } .card-redirect-info { text-align: center; } .animate-fade-in { animation: fadeIn .4s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .tab-label-content { display: flex; align-items: center; gap: 8px; height: 60px; } ::ng-deep .payment-tabs .mat-mdc-tab-header { background-color: var(--white-color); } ::ng-deep .payment-tabs .mdc-tab__text-label { color: var(--dark-gray); font-weight: 500; } ::ng-deep .payment-tabs .mat-mdc-tab.mat-mdc-tab-active .mdc-tab__text-label { color: var(--brand-turquoise) !important; } ::ng-deep .payment-tabs .mat-mdc-tab-indicator-bar { background-color: var(--brand-turquoise) !important; } ::ng-deep .mat-mdc-form-field.mat-focused .mdc-floating-label, ::ng-deep .mat-mdc-form-field.mat-focused mat-icon { color: var(--brand-turquoise) !important; }`]
})
export class PaymentModalComponent {
    stkForm: FormGroup; mpesaSubMethod: 'stk' | 'paybill' = 'stk'; isProcessingStk = false; isVerifyingPaybill = false; isRedirectingToCard = false;
    constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<PaymentModalComponent>, @Inject(MAT_DIALOG_DATA) public data: MpesaPayment) { this.stkForm = this.fb.group({ phoneNumber: [data.phoneNumber || '', [Validators.required, Validators.pattern(/^(07|01)\d{8}$/)]] }); }
    closeDialog(result: PaymentResult | null = null): void { this.dialogRef.close(result); }
    processStkPush(): void { if (this.stkForm.invalid) return; this.isProcessingStk = true; setTimeout(() => { this.isProcessingStk = false; this.closeDialog({ success: true, method: 'stk', reference: this.data.reference, mpesaReceipt: 'S' + Math.random().toString(36).substring(2, 12).toUpperCase() }); }, 3000); }
    verifyPaybillPayment(): void { this.isVerifyingPaybill = true; setTimeout(() => { this.isVerifyingPaybill = false; this.closeDialog({ success: true, method: 'paybill', reference: this.data.reference }); }, 3500); }
    redirectToCardGateway(): void { this.isRedirectingToCard = true; setTimeout(() => { this.isRedirectingToCard = false; this.closeDialog({ success: true, method: 'card', reference: this.data.reference }); }, 2000); }
}

// --- MAIN MARINE CARGO QUOTATION COMPONENT ---
@Component({
    selector: 'app-marine-cargo-quotation',
    standalone: true,
    imports: [ CommonModule, ReactiveFormsModule, RouterLink, CurrencyPipe, DecimalPipe, MatDialogModule, MatIconModule, TitleCasePipe, PaymentModalComponent ],
    templateUrl: './marine-cargo-quotation.component.html',
    styleUrls: ['./marine-cargo-quotation.component.scss'],
})
export class MarineCargoQuotationComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();
    quotationForm: FormGroup;
    exportRequestForm: FormGroup;
    highRiskRequestForm: FormGroup;
    currentStep: number = 1;
    showExportModal: boolean = false;
    showHighRiskModal: boolean = false;
    toastMessage: string = '';
    importerDetails: ImporterDetails = { name: '', kraPin: '' };
    premiumCalculation: PremiumCalculation = this.resetPremiumCalculation();
    private editModeQuoteId: string | null = null;
    isLoggedIn: boolean = false;
    currentUser: StoredUser | null = null;
    displayUser: DisplayUser = { type: 'individual', name: 'Individual User' };
    private readonly TAX_RATES = { PHCF_RATE: 0.0025, TRAINING_LEVY: 0.0025, COMMISSION_RATE: 0.1, STAMP_DUTY_RATE: 0.05 };
    readonly marineProducts: MarineProduct[] = [ { code: 'ICC_A', name: 'Institute Cargo Clauses (A) - All Risks', rate: 0.005 }, { code: 'ICC_B', name: 'Institute Cargo Clauses (B) - Named Perils', rate: 0.0035 }, { code: 'ICC_C', name: 'Institute Cargo Clauses (C) - Limited Perils', rate: 0.0025 } ];
    readonly marineCargoTypes: string[] = [ 'Pharmaceuticals', 'Electronics', 'Apparel', 'Vehicles', 'Machinery', 'General Goods' ];
    readonly blacklistedCountries: string[] = [ 'Russia', 'Ukraine', 'North Korea', 'Syria', 'Iran', 'Yemen', 'Sudan', 'Somalia' ];
    readonly allCountriesList: string[] = [ 'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'China', 'Denmark', 'Egypt', 'Finland', 'France', 'Germany', 'Ghana', 'Greece', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Kenya', 'Mexico', 'Netherlands', 'New Zealand', 'Nigeria', 'North Korea', 'Norway', 'Pakistan', 'Russia', 'Saudi Arabia', 'Somalia', 'South Africa', 'Spain', 'Sudan', 'Sweden', 'Switzerland', 'Syria', 'Tanzania', 'Turkey', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States of America', 'Yemen', 'Zambia', 'Zimbabwe' ];

    constructor(
        private fb: FormBuilder,
        private router: Router,
        public dialog: MatDialog,
        private authService: AuthService,
        private route: ActivatedRoute
    ) {
        this.quotationForm = this.createQuotationForm();
        this.exportRequestForm = this.createExportRequestForm();
        this.highRiskRequestForm = this.createHighRiskRequestForm();
    }
    
    ngOnInit(): void {
        this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
            this.isLoggedIn = !!user;
            this.currentUser = user;
            if (user) { this.displayUser = { type: user.type, name: user.name }; this.prefillClientDetails(); } 
            else { this.displayUser = { type: 'individual', name: 'Individual User' }; }
        });
        this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
            const quoteId = params['editId'];
            if (quoteId) { this.editModeQuoteId = quoteId; this.loadQuoteForEditing(quoteId); }
        });
        this.setupFormSubscriptions();
        this.setDefaultDate();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private createQuotationForm(): FormGroup { 
        return this.fb.group({ 
            // Customer Details
            firstName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s'-]+$/)]], 
            lastName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s'-]+$/)]], 
            email: ['', [Validators.required, Validators.email]], 
            phoneNumber: ['', [Validators.required, Validators.pattern(/^(07|01)\d{8}$/)]], 
            idNumber: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]{5,15}$/)]], 
            kraPin: ['', [Validators.required, Validators.pattern(/^[A-Z]\d{9}[A-Z]$/i)]], 
            
            // KYC Documents (NEW)
            kraPinUpload: [null, Validators.required],
            nationalIdUpload: [null, Validators.required],
            invoiceUpload: [null, Validators.required],
            idfUpload: [null, Validators.required],
            
            termsAndPolicyConsent: [false, Validators.requiredTrue], 
            
            // Shipment Details
            cargoType: ['', Validators.required], 
            tradeType: ['import', Validators.required], 
            modeOfShipment: ['', Validators.required], 
            marineProduct: ['Institute Cargo Clauses (A) - All Risks', Validators.required], 
            marineCargoType: ['', Validators.required], 
            origin: ['', Validators.required], 
            destination: [''], 
            vesselName: ['', Validators.required], 
            coverStartDate: ['', [Validators.required, this.noPastDatesValidator]], 
            sumInsured: ['', [Validators.required, Validators.min(10000)]], 
            descriptionOfGoods: ['', [Validators.required, Validators.minLength(20)]], 
            ucrNumber: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9]+$/), Validators.minLength(15)]], 
            idfNumber: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9]+$/), Validators.minLength(15)]], 
        }); 
    }

    // --- All other methods remain unchanged as they are not affected by this UI change ---
    onSubmit(): void { if (this.quotationForm.invalid) { this.quotationForm.markAllAsTouched(); this.showToast('Please correct the errors before proceeding.'); return; } if (!this.showHighRiskModal && !this.showExportModal) { this.calculatePremium(); const newQuote: PendingQuote = { id: this.editModeQuoteId || `GEM-Q-${Date.now()}`, title: `Marine - ${this.quotationForm.value.marineCargoType || 'Quote'}`, type: 'marine', status: 'pending', createdDate: new Date().toISOString(), quoteDetails: this.quotationForm.value, premium: this.premiumCalculation }; this.authService.savePendingQuote(newQuote); this.showToast('Your quote has been saved! Please review and proceed.'); this.goToStep(2); } }
    handlePayment(): void { if (this.isLoggedIn) { this.openPaymentModal(); } else { this.showToast('Your quote has been saved. Please log in or sign up to complete payment.'); this.router.navigate(['/']); } }
    closeForm(): void { if (this.isLoggedIn) { this.router.navigate(['/dashboard']); } else { this.router.navigate(['/']); } }
    switchUser(event: any): void { const userType = event.target.value as 'individual' | 'intermediary'; this.displayUser.type = userType; this.showToast(`Switched to ${userType} view.`); if (this.currentStep === 2) { this.calculatePremium(); } }
    private openPaymentModal(): void { const dialogRef = this.dialog.open(PaymentModalComponent, { data: { amount: this.premiumCalculation.totalPayable, phoneNumber: this.quotationForm.get('phoneNumber')?.value, reference: this.editModeQuoteId || `GEM${Date.now()}`, description: `Marine Cargo - ${this.quotationForm.get('marineCargoType')?.value}` }, panelClass: 'payment-dialog-container', autoFocus: false }); dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: PaymentResult | null) => { if (result?.success) { if (this.editModeQuoteId) { this.authService.removePendingQuote(this.editModeQuoteId); } this.showToast('Payment successful! Redirecting to your dashboard.'); setTimeout(() => { this.router.navigate(['/dashboard']); }, 2000); } }); }
    private prefillClientDetails(): void { if (!this.currentUser) return; const registrationData = this.authService.getRegistrationData(); if (registrationData) { const nameParts = registrationData.fullName?.split(' ') || [this.currentUser.name]; this.quotationForm.patchValue({ firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '', email: this.currentUser.email, phoneNumber: registrationData.phoneNumber || this.currentUser.phoneNumber || '' }); } }
    private loadQuoteForEditing(quoteId: string): void { const quoteToEdit = this.authService.getPendingQuotes().find(q => q.id === quoteId); if (quoteToEdit) { this.quotationForm.patchValue(quoteToEdit.quoteDetails); this.premiumCalculation = quoteToEdit.premium; this.goToStep(2); this.showToast(`Editing your saved quote: ${quoteToEdit.title}.`); } else { this.showToast('Could not find the quote you want to edit.'); this.router.navigate(['/dashboard']); } }
    private createModalForm(): FormGroup { return this.fb.group({ kraPin: ['', [Validators.required, Validators.pattern(/^[A-Z]\d{9}[A-Z]$/i)]], firstName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s'-]+$/)]], lastName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s'-]+$/)]], email: ['', [Validators.required, Validators.email]], phoneNumber: ['', [Validators.required, Validators.pattern(/^(07|01)\d{8}$/)]], marineProduct: ['Institute Cargo Clauses (A) - All Risks', Validators.required], marineCargoType: ['', Validators.required], idfNumber: ['', [Validators.pattern(/^[a-zA-Z0-9]+$/), Validators.minLength(15)]], ucrNumber: ['', [Validators.pattern(/^[a-zA-Z0-_]+$/), Validators.minLength(15)]], originCountry: ['', Validators.required], destinationCountry: ['', Validators.required], shipmentDate: ['', [Validators.required, this.noPastDatesValidator]], goodsDescription: ['', [Validators.required, Validators.minLength(20), maxWords(100)]], termsAndPolicyConsent: [false, Validators.requiredTrue], }); }
    private createExportRequestForm(): FormGroup { const form = this.createModalForm(); form.get('originCountry')?.patchValue('Kenya'); form.get('originCountry')?.disable(); return form; }
    private createHighRiskRequestForm(): FormGroup { return this.createModalForm(); }
    private setDefaultDate(): void { this.quotationForm.patchValue({ coverStartDate: this.getToday() }); }
    private setupFormSubscriptions(): void { this.quotationForm.get('modeOfShipment')?.valueChanges.subscribe((mode) => { this.quotationForm.get('destination')?.setValue(mode === 'sea' ? 'Mombasa, Kenya' : mode === 'air' ? 'JKIA, Nairobi, Kenya' : ''); }); this.quotationForm.get('tradeType')?.valueChanges.subscribe((type) => { if (type === 'export') this.showExportModal = true; }); this.quotationForm.get('origin')?.valueChanges.subscribe((country) => { if (this.blacklistedCountries.includes(country)) { this.highRiskRequestForm.patchValue({ originCountry: country }); this.showHighRiskModal = true; } }); this.quotationForm.get('ucrNumber')?.valueChanges.subscribe(() => { this.importerDetails = this.quotationForm.get('ucrNumber')?.valid ? { name: 'Global Imports Ltd.', kraPin: 'P051234567X' } : { name: '', kraPin: '' }; }); }
    private calculatePremium(): void { const sumInsured = this.quotationForm.get('sumInsured')?.value || 0; const productValue = this.quotationForm.get('marineProduct')?.value; const selectedProduct = this.marineProducts.find((p) => p.name === productValue); const rate = selectedProduct ? selectedProduct.rate : 0; const { PHCF_RATE, TRAINING_LEVY, COMMISSION_RATE, STAMP_DUTY_RATE } = this.TAX_RATES; const basePremium = sumInsured * rate; const phcf = basePremium * PHCF_RATE; const trainingLevy = basePremium * TRAINING_LEVY; const stampDuty = sumInsured * STAMP_DUTY_RATE; const commission = this.displayUser.type === 'intermediary' ? basePremium * COMMISSION_RATE : 0; const totalPayable = basePremium + phcf + trainingLevy + stampDuty - commission; this.premiumCalculation = { basePremium, phcf, trainingLevy, stampDuty, commission, totalPayable, currency: 'KES' }; }
    private resetPremiumCalculation(): PremiumCalculation { return { basePremium: 0, phcf: 0, trainingLevy: 0, stampDuty: 0, commission: 0, totalPayable: 0, currency: 'KES' }; }
    onExportRequestSubmit(): void { if (this.exportRequestForm.valid) { this.closeAllModals(); this.showToast('Export request submitted. Our underwriter will contact you.'); }}
    onHighRiskRequestSubmit(): void { if (this.highRiskRequestForm.valid) { this.closeAllModals(); this.showToast('High-risk shipment request submitted for review.'); }}
    closeAllModals(): void { this.showExportModal = false; this.showHighRiskModal = false; this.quotationForm.get('tradeType')?.setValue('import', { emitEvent: false }); this.quotationForm.get('origin')?.setValue('', { emitEvent: false }); this.exportRequestForm.reset({ marineProduct: 'Institute Cargo Clauses (A) - All Risks', originCountry: 'Kenya' }); this.highRiskRequestForm.reset({ marineProduct: 'Institute Cargo Clauses (A) - All Risks' }); }
    private showToast(message: string): void { this.toastMessage = message; setTimeout(() => (this.toastMessage = ''), 5000); }
    downloadQuote(): void { if (this.quotationForm.valid) { this.showToast('Quote download initiated successfully.'); } }
    getToday(): string { return new Date().toISOString().split('T')[0]; }
    noPastDatesValidator(control: AbstractControl): { [key: string]: boolean } | null { if (!control.value) return null; return control.value < new Date().toISOString().split('T')[0] ? { pastDate: true } : null; }
    goToStep(step: number): void { this.currentStep = step; }
    isFieldInvalid(form: FormGroup, field: string): boolean { const control = form.get(field); return !!control && control.invalid && (control.dirty || control.touched); }
    getErrorMessage(form: FormGroup, field: string): string { const control = form.get(field); if (!control || !control.errors) return ''; if (control.hasError('required')) return 'This field is required.'; if (control.hasError('email')) return 'Please enter a valid email address.'; if (control.hasError('min')) return `The minimum value is ${control.errors['min'].min}.`; if (control.hasError('pattern')) { switch (field) { case 'kraPin': return 'Invalid KRA PIN format (e.g., A123456789Z).'; case 'phoneNumber': return 'Invalid phone number format (e.g., 0712345678).'; default: return 'Invalid format.'; }} return 'Invalid input.'; }
}