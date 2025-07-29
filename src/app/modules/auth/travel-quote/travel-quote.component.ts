import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MpesaPaymentModalComponent, PaymentResult } from '../shared/payment-modal.component';

// --- Data Structures ---
interface TravelPlan { id: string; name: string; description: string; benefits: Benefit[]; }
interface Benefit { name: string; limit: string; }
interface Premium {
  baseRateUSD: number;
  subtotalUSD: number;
  groupDiscountUSD: number;
  ageSurchargeUSD: number;
  winterSportsSurchargeUSD: number;
  totalPayableUSD: number;
  totalPayableKES: number;
  durationDays: number;
}
interface TravelPlanWithBenefits extends Omit<TravelPlan, 'benefits'> {
  keyBenefits: string[];
}


@Component({
  selector: 'app-travel-quote',
  standalone: true,
  imports: [ CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule ],
  templateUrl: './travel-quote.component.html',
  styleUrls: ['./travel-quote.component.scss'],
})
export class TravelQuoteComponent implements OnInit {
  currentStep: number = 1;
  quotationForm: FormGroup;
  travelerDetailsForm: FormGroup;
  premium: Premium = this.resetPremium();
  selectedPlanDetails: TravelPlan | null = null;
  travelPlansWithBenefits: TravelPlanWithBenefits[] = [];

  private readonly USD_TO_KES_RATE = 130.00;

  private rates: { [duration: string]: { [plan: string]: number } } = {
    '4': { AFRICA: 9, ASIA: 9, EUROPE: 11, BASIC: 15, PLUS: 27, EXTRA: 34 },
    '7': { AFRICA: 12, ASIA: 14, EUROPE: 15, BASIC: 20, PLUS: 36, EXTRA: 43 },
    '10': { AFRICA: 17, ASIA: 19, EUROPE: 22, BASIC: 28, PLUS: 51, EXTRA: 62 },
    '15': { AFRICA: 18, ASIA: 20, EUROPE: 25, BASIC: 30, PLUS: 55, EXTRA: 67 },
    '21': { AFRICA: 20, ASIA: 25, EUROPE: 28, BASIC: 32, PLUS: 58, EXTRA: 72 },
    '31': { AFRICA: 32, ASIA: 33, EUROPE: 38, BASIC: 48, PLUS: 90, EXTRA: 111 },
    '62': { AFRICA: 50, ASIA: 52, EUROPE: 57, BASIC: 70, PLUS: 138, EXTRA: 165 },
    '92': { AFRICA: 59, ASIA: 59, EUROPE: 74, BASIC: 98, PLUS: 179, EXTRA: 202 },
    '180': { AFRICA: 70, ASIA: 70, EUROPE: 80, BASIC: 106, PLUS: 193, EXTRA: 240 },
    '365': { AFRICA: 82, ASIA: 90, EUROPE: 103, BASIC: 136, PLUS: 248, EXTRA: 295 },
  };

  private allPlanBenefits: { [key: string]: Benefit[] } = {
    'AFRICA': [ { name: 'Medical Expenses & Hospitalization', limit: '$15,000' }, { name: 'Emergency medical evacuation', limit: '$15,000' }, { name: 'Repatriation of mortal remains', limit: '$10,000' }, { name: 'In-flight checked-in baggage', limit: '$1,500' }],
    'ASIA': [ { name: 'Medical Expenses & Hospitalization', limit: '$15,000' }, { name: 'Emergency medical evacuation', limit: '$15,000' }, { name: 'Repatriation of mortal remains', limit: '$10,000' }, { name: 'In-flight checked-in baggage', limit: '$1,500' }],
    'EUROPE': [ { name: 'Medical Expenses & Hospitalization', limit: '€36,000' }, { name: 'Emergency medical evacuation', limit: '€36,000' }, { name: 'Repatriation of mortal remains', limit: '€10,000' }, { name: 'Accidental Death (Public Transport)', limit: '€10,000' }],
    'BASIC': [ { name: 'Medical Expenses & Hospitalization', limit: '$40,000' }, { name: 'Emergency medical evacuation', limit: '$40,000' }, { name: 'Personal Civil Liability', limit: '$100,000' }, { name: 'Journey Cancellation', limit: '$2,000' }],
    'PLUS': [ { name: 'Medical Expenses & Hospitalization', limit: '$75,000' }, { name: 'Emergency medical evacuation', limit: '$75,000' }, { name: 'Personal Civil Liability', limit: '$150,000' }, { name: 'Journey Cancellation', limit: '$3,000' }],
    'EXTRA': [ { name: 'Medical Expenses & Hospitalization', limit: '$150,000' }, { name: 'Emergency medical evacuation', limit: '$150,000' }, { name: 'Personal Civil Liability', limit: '$150,000' }, { name: 'Accidental Death (Public Transport)', limit: '$50,000' }]
  };
  
  constructor(private fb: FormBuilder, private router: Router, private dialog: MatDialog) {
    this.quotationForm = this.fb.group({
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      numTravelers: [1, [Validators.required, Validators.min(1)]],
      plan: ['AFRICA', Validators.required],
      winterSports: [false]
    }, { validators: this.dateRangeValidator });

    //
    // FIX IS HERE: Updated the travelerDetailsForm definition
    //
    this.travelerDetailsForm = this.fb.group({
      title: ['Mr', Validators.required],
      fullName: ['', Validators.required],
      // 1. Add custom validator and set updateOn blur
      dob: ['', { validators: [Validators.required, this.noFutureDatesValidator], updateOn: 'blur' }],
      beneficiary: ['', Validators.required],
      purposeOfTrip: ['', Validators.required],
      passportNo: [''],
      kraPin: [''],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern('^07[0-9]{8}$')]],
      homeDoctor: [''],
      termsAndConditions: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    this.travelPlansWithBenefits = [
      { id: 'AFRICA', name: 'Africa', description: 'Value cover for travel', keyBenefits: ['Medical up to $15,000', 'Evacuation up to $15,000', 'Baggage up to $1,500'] },
      { id: 'ASIA', name: 'Asia', description: 'Value cover for travel', keyBenefits: ['Medical up to $15,000', 'Evacuation up to $15,000', 'Baggage up to $1,500'] },
      { id: 'EUROPE', name: 'Europe Basic', description: 'Limits for transfers to Europe', keyBenefits: ['Medical up to €36,000', 'Evacuation up to €36,000', 'Accidental Death up to €10,000'] },
      { id: 'BASIC', name: 'Worldwide Basic', description: 'Basic worldwide cover', keyBenefits: ['Medical up to $40,000', 'Liability up to $100,000', 'Cancellation up to $2,000'] },
      { id: 'PLUS', name: 'Worldwide Plus', description: 'Comprehensive insurance', keyBenefits: ['Medical up to $75,000', 'Liability up to $150,000', 'Cancellation up to $3,000'] },
      { id: 'EXTRA', name: 'Worldwide Extra', description: 'Extra protection', keyBenefits: ['Medical up to $150,000', 'Liability up to $150,000', 'Accidental Death up to $50,000'] },
    ];

    const recalculate = () => { if (this.quotationForm.valid) this.calculatePremium(); };
    this.quotationForm.valueChanges.subscribe(recalculate);
    this.travelerDetailsForm.get('dob')?.valueChanges.subscribe(recalculate);
    this.calculatePremium();
  }

  calculatePremium(): void {
    if (!this.quotationForm.valid) { this.premium = this.resetPremium(); return; }
    const values = this.quotationForm.value;
    const diffTime = Math.abs(new Date(values.endDate).getTime() - new Date(values.startDate).getTime());
    const durationDays = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1, 1);
    const durationTier = this.getDurationTier(durationDays);
    if (!durationTier) { this.premium = this.resetPremium(); return; }
    
    const ratePlanId = values.plan;
    const baseRateUSD = this.rates[durationTier][ratePlanId] || 0;
    
    let subtotalUSD = baseRateUSD * values.numTravelers;

    let groupDiscountUSD = 0;
    if (values.numTravelers >= 201) groupDiscountUSD = subtotalUSD * 0.25;
    else if (values.numTravelers >= 101) groupDiscountUSD = subtotalUSD * 0.20;
    else if (values.numTravelers >= 51) groupDiscountUSD = subtotalUSD * 0.15;
    else if (values.numTravelers >= 21) groupDiscountUSD = subtotalUSD * 0.10;
    else if (values.numTravelers >= 10) groupDiscountUSD = subtotalUSD * 0.05;

    let ageSurchargeUSD = 0;
    const dob = this.travelerDetailsForm.get('dob')?.value;
    if (dob) {
        const age = new Date().getFullYear() - new Date(dob).getFullYear();
        if (age < 3) ageSurchargeUSD = -(subtotalUSD * 0.50);
        else if (age >= 81) ageSurchargeUSD = subtotalUSD * 3.00;
        else if (age >= 76) ageSurchargeUSD = subtotalUSD * 1.00;
        else if (age >= 66) ageSurchargeUSD = subtotalUSD * 0.50;
    }
    
    const winterSportsSurchargeUSD = values.winterSports ? subtotalUSD * 1.00 : 0;
    const totalPayableUSD = subtotalUSD - groupDiscountUSD + ageSurchargeUSD + winterSportsSurchargeUSD;
    const totalPayableKES = totalPayableUSD * this.USD_TO_KES_RATE;

    this.premium = { baseRateUSD, subtotalUSD, groupDiscountUSD, ageSurchargeUSD, winterSportsSurchargeUSD, totalPayableUSD, totalPayableKES, durationDays };
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
    if (this.travelerDetailsForm.invalid) { this.travelerDetailsForm.markAllAsTouched(); return; }
    const dialogRef = this.dialog.open(MpesaPaymentModalComponent, {
      data: {
        amount: this.premium.totalPayableKES,
        phoneNumber: this.travelerDetailsForm.get('phoneNumber')?.value,
        reference: `FID-TRV-${Date.now()}`,
        description: `${this.getPlanName(this.quotationForm.value.plan)} Cover`
      }
    });
    dialogRef.afterClosed().subscribe((result: PaymentResult | null) => { if (result?.success) this.router.navigate(['/dashboard']); });
  }

  private getDurationTier(days: number): string | null {
    if (days <= 4) return '4'; if (days <= 7) return '7'; if (days <= 10) return '10'; if (days <= 15) return '15'; if (days <= 21) return '21';
    if (days <= 31) return '31'; if (days <= 62) return '62'; if (days <= 92) return '92'; if (days <= 180) return '180'; if (days <= 365) return '365';
    return null;
  }
  
  getToday(): string { return new Date().toISOString().split('T')[0]; }
  dateRangeValidator(group: AbstractControl): { [key: string]: boolean } | null { const start = group.get('startDate')?.value; const end = group.get('endDate')?.value; return start && end && start > end ? { invalidDateRange: true } : null; }
  
  // 2. Added new validator function for Date of Birth
  noFutureDatesValidator(control: AbstractControl): { [key: string]: boolean } | null {
    if (!control.value) return null;
    const selectedDate = new Date(control.value);
    const today = new Date();
    // Set hours to 0 to compare dates only
    today.setHours(0, 0, 0, 0);
    return selectedDate > today ? { futureDate: true } : null;
  }

  getPlanName(planId: string): string { return this.travelPlansWithBenefits.find(p => p.id === planId)?.name || 'Unknown Plan'; }
  closeForm(): void { this.router.navigate(['/dashboard']); }
  
  private resetPremium(): Premium {
    return { baseRateUSD: 0, subtotalUSD: 0, groupDiscountUSD: 0, ageSurchargeUSD: 0, winterSportsSurchargeUSD: 0, totalPayableUSD: 0, totalPayableKES: 0, durationDays: 0 };
  }
  
  private getFullPlanDetails(planId: string): TravelPlan | null {
    const planInfo = this.travelPlansWithBenefits.find(p => p.id === planId);
    return planInfo ? { ...planInfo, benefits: this.allPlanBenefits[planId] || [] } : null;
  }

  abs(value: number): number {
    return Math.abs(value);
  }
}