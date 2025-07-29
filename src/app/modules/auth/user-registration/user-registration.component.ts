import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MpesaPaymentModalComponent, PaymentResult } from '../shared/payment-modal.component';

// --- Interfaces & Validators ---
interface PremiumCalculation { basePremium: number; phcf: number; trainingLevy: number; stampDuty: number; commission: number; totalPayable: number; currency: string; }
interface MarineProduct { code: string; name: string; rate: number; }
interface User { type: 'individual' | 'intermediary'; name: string; }
interface ImporterDetails { name: string; kraPin: string; }
export function maxWords(max: number) { return (control: AbstractControl): { [key: string]: any } | null => { if (!control.value) return null; const words = control.value.trim().split(/\s+/).length; return words > max ? { 'maxWords': { max, actual: words } } : null; }; }
class AuthService { private _loggedIn = true; isLoggedIn(): boolean { return this._loggedIn; } }

@Component({
    selector: 'app-marine-cargo-quotation',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, CurrencyPipe, DecimalPipe, MatDialogModule],
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
    private openPaymentModal(): void { const dialogRef = this.dialog.open(MpesaPaymentModalComponent, { data: { amount: this.premiumCalculation.totalPayable, phoneNumber: this.clientDetailsForm.get('phoneNumber')?.value, reference: `FID${Date.now()}`, description: 'Marine Insurance' } }); dialogRef.afterClosed().subscribe((result: PaymentResult | null) => { if (result?.success) { this.showToast('Payment successful! Your certificate is ready.', 'success'); setTimeout(() => this.downloadCertificate(), 1500); } }); }
    downloadCertificate(): void { this.showToast("Your policy certificate has been downloaded.", 'success'); console.log("Certificate download process initiated."); setTimeout(() => this.closeForm(), 2000); }
    closeForm(): void { if (this.isLoggedIn) { this.router.navigate(['/dashboard']); } else { this.router.navigate(['/']); } }
    getToday(): string { return new Date().toISOString().split('T')[0]; }
    noPastDatesValidator(control: AbstractControl): { [key: string]: boolean } | null { if (!control.value) return null; return control.value < new Date().toISOString().split('T')[0] ? { pastDate: true } : null; }
    goToStep(step: number): void { this.currentStep = step; }
    switchUser(event: any): void { const userType = event.target.value as 'individual' | 'intermediary'; this.currentUser = { type: userType, name: userType === 'intermediary' ? 'Intermediary User' : 'Individual User' }; this.showToast(`Switched to ${this.currentUser.name} view.`, 'info'); if (this.currentStep === 2) { this.calculatePremium(); } }
}