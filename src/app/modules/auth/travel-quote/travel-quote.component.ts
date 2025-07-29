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
interface Premium { baseRate: number; subtotal: number; groupDiscount: number; ageSurcharge: number; winterSportsSurcharge: number; totalPayable: number; durationDays: number; }

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