import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Subject, take, takeUntil, debounceTime } from 'rxjs';
import { MpesaPaymentModalComponent, PaymentResult } from '../../auth/shared/payment-modal.component';
import { AuthService } from 'app/core/auth/auth.service';
import { TravelQuoteService } from './travel-quote.service';

// --- Data Structures ---
interface BenefitDetail {
  name: string;
  included: boolean;
  limit?: string;
  notes?: string;
}

interface TravelPlan {
  id: string;
  name: string;
  description: string;
  type: 'standard' | 'student';
  priceUSD?: number;
  tags: string[];
  isMostPopular?: boolean;
  benefits: BenefitDetail[];
}

interface Premium {
  baseRateUSD: number; subtotalUSD: number; groupDiscountUSD: number; ageSurchargeUSD: number; winterSportsSurchargeUSD: number;
  totalPayableUSD: number; totalPayableKES: number; groupDiscountPercentage: number; ageAdjustmentPercentage: number;
}

@Component({
  selector: 'app-travel-quote',
  standalone: true,
  imports: [ CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, DatePipe, DecimalPipe ],
  templateUrl: './travel-quote.component.html',
  styleUrls: ['./travel-quote.component.scss'],
})
export class TravelQuoteComponent implements OnInit, OnDestroy {
  currentStep: number = 1;
  quoteForm: FormGroup;
  travelerDetailsForm: FormGroup;
  premium: Premium = this.resetPremium();
  selectedPlanDetails: TravelPlan | null = null;
  allTravelPlans: TravelPlan[] = [];
  displayedPlans: TravelPlan[] = [];
  
  readonly standardDurations = [ {value: '4', label: 'Up to 4 days'}, {value: '7', label: 'Up to 7 days'}, {value: '10', label: 'Up to 10 days'}, {value: '15', label: 'Up to 15 days'}, {value: '21', label: 'Up to 21 days'}, {value: '31', label: 'Up to 31 days'}, {value: '62', label: 'Up to 62 days'}, {value: '92', label: 'Up to 92 days'}, {value: '180', label: 'Up to 180 days'}, {value: '365', label: '1 year multi-trip'} ];
  readonly studentDurations = [ {value: '180', label: '6 months (180 days)'}, {value: '270', label: '9 months (270 days)'}, {value: '365', label: '1 year (365 days)'} ];
  
  private unsubscribe$ = new Subject<void>();
  private readonly USD_TO_KES_RATE = 130.00;

  private standardRates: { [duration: string]: { [planId: string]: number } } = { '4': {'AFRICA_ASIA': 85, 'EUROPE': 36, 'WW_BASIC': 140, 'WW_PLUS': 175, 'WW_EXTRA': 160}, /* ... other dynamic rates if needed ... */ };
  private studentRates: { [duration: string]: { [planId: string]: number } } = { '180': { 'STUDENT_CLASSIC': 361, 'STUDENT_PREMIUM': 496 }, '270': { 'STUDENT_CLASSIC': 470, 'STUDENT_PREMIUM': 626 }, '365': { 'STUDENT_CLASSIC': 602, 'STUDENT_PREMIUM': 715 }, };
  
  constructor(
    private fb: FormBuilder, 
    private router: Router, 
    private dialog: MatDialog, 
    private authService: AuthService,
    private travelQuoteService: TravelQuoteService
  ) {
    // Note: The prices in the first image ($85, $36 etc) don't match the dynamic rate table in the second.
    // I am prioritizing the prices from the first image as requested by the UI design.
    // The rate table is still used for Student plans.
    this.standardRates = {
        'default': {
            'AFRICA_ASIA': 85.00,
            'EUROPE': 36.00,
            'WW_BASIC': 140.00,
            'WW_PLUS': 175.00,
            'WW_EXTRA': 160.00
        }
    };

    this.quoteForm = this.fb.group({
      policyType: ['standard', Validators.required],
      duration: ['', Validators.required],
      plan: ['', Validators.required],
    });

    this.travelerDetailsForm = this.fb.group({
      fullName: ['', Validators.required],
      dob: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^0[17]\d{8}$/)]],
      numTravelers: [1, [Validators.required, Validators.min(1)]],
      winterSports: [false],
    });
  }

  get qf() { return this.quoteForm.controls; }

  ngOnInit(): void {
    this.initializePlans();
    this.updateDisplayedPlans(this.qf.policyType.value);
    
    this.quoteForm.valueChanges.pipe(takeUntil(this.unsubscribe$), debounceTime(50)).subscribe(values => {
      this.updateDisplayedPlans(values.policyType);
      this.updatePlanPrices(values.policyType, values.duration);
    });
    
    this.travelerDetailsForm.valueChanges.pipe(takeUntil(this.unsubscribe$), debounceTime(300)).subscribe(() => {
        if (this.currentStep > 1) this.calculatePremium();
    });
  }

  ngOnDestroy(): void { this.unsubscribe$.next(); this.unsubscribe$.complete(); }
  
  updateDisplayedPlans(type: 'standard' | 'student'): void {
    const currentType = this.displayedPlans[0]?.type;
    if (currentType === type) return;

    this.displayedPlans = this.allTravelPlans.filter(p => p.type === type);
    // Reset duration and plan selection only when type actually changes
    if (this.qf.policyType.value !== currentType) {
        this.qf.duration.setValue('', { emitEvent: false });
        this.qf.plan.setValue('', { emitEvent: false });
    }
  }

  updatePlanPrices(type: 'standard' | 'student', duration: string): void {
    if (!duration) {
      this.displayedPlans.forEach(plan => plan.priceUSD = 0);
      return;
    };
    
    const rateTable = (type === 'student') ? this.studentRates : this.standardRates;
    const durationKey = (type === 'student') ? duration : 'default';

    this.displayedPlans.forEach(plan => {
        plan.priceUSD = rateTable[durationKey]?.[plan.id] || 0;
    });
  }
  
  calculatePremium(): void {
    this.selectedPlanDetails = this.allTravelPlans.find(p => p.id === this.qf.plan.value) || null;
    if (this.quoteForm.invalid || this.travelerDetailsForm.invalid || !this.selectedPlanDetails) {
      this.premium = this.resetPremium(); return;
    }

    const traveler = this.travelerDetailsForm.value;
    const baseRateUSD = this.selectedPlanDetails.priceUSD || 0;
    let subtotalUSD = baseRateUSD * traveler.numTravelers;
    
    let groupDiscountPercentage = 0;
    const num = traveler.numTravelers;
    if (num >= 10 && num <= 20) groupDiscountPercentage = 5;
    else if (num >= 21 && num <= 50) groupDiscountPercentage = 10;
    else if (num >= 51 && num <= 100) groupDiscountPercentage = 15;
    else if (num >= 101 && num <= 200) groupDiscountPercentage = 20;
    else if (num >= 201) groupDiscountPercentage = 25;
    const groupDiscountUSD = subtotalUSD * (groupDiscountPercentage / 100);

    let ageAdjustmentPercentage = 0;
    const birthDate = new Date(traveler.dob);
    const age = new Date(new Date().getTime() - birthDate.getTime()).getFullYear() - 1970;
    
    if (age < 18) ageAdjustmentPercentage = -50;
    else if (age >= 66 && age <= 75) ageAdjustmentPercentage = 50;
    else if (age >= 76 && age <= 80) ageAdjustmentPercentage = 100;
    else if (age >= 81) ageAdjustmentPercentage = 300;
    const ageSurchargeUSD = (subtotalUSD * (ageAdjustmentPercentage / 100));

    const winterSportsSurchargeUSD = traveler.winterSports ? subtotalUSD : 0;
    const totalPayableUSD = subtotalUSD - groupDiscountUSD + ageSurchargeUSD + winterSportsSurchargeUSD;
    
    this.premium = {
      baseRateUSD, subtotalUSD, groupDiscountUSD, ageSurchargeUSD, winterSportsSurchargeUSD, totalPayableUSD,
      totalPayableKES: totalPayableUSD * this.USD_TO_KES_RATE,
      groupDiscountPercentage, ageAdjustmentPercentage
    };
  }

  nextStep(): void { 
    if (this.currentStep === 1 && this.quoteForm.invalid) { this.quoteForm.markAllAsTouched(); return; }
    if (this.currentStep === 2 && this.travelerDetailsForm.invalid) { this.travelerDetailsForm.markAllAsTouched(); return; }
    if (this.currentStep < 3) {
      this.calculatePremium();
      if (this.currentStep === 2) {
        this.saveQuoteToLocalStorage();
      }
      this.currentStep++;
    } 
  }
  
  prevStep(): void { if (this.currentStep > 1) this.currentStep--; }

  saveQuoteToLocalStorage(): void {
    if (this.travelerDetailsForm.invalid || !this.selectedPlanDetails) return;
    this.travelQuoteService.saveQuote({
        planDetails: { name: this.selectedPlanDetails.name, duration: this.getDurationText(this.qf.duration.value) },
        travelerDetails: this.travelerDetailsForm.value,
        premiumSummary: this.premium
    });
  }

  handlePayment(): void {
    if (this.travelerDetailsForm.invalid) return;
    this.authService.check().pipe(take(1)).subscribe(isAuthenticated => {
      if (isAuthenticated) { this.openPaymentDialog(); } 
      else { this.router.navigate(['/']); }
    });
  }

  private openPaymentDialog(): void {
    const dialogRef = this.dialog.open(MpesaPaymentModalComponent, {
      data: { amount: this.premium.totalPayableKES, phoneNumber: this.travelerDetailsForm.get('phoneNumber')?.value, reference: `FID-TRV-${Date.now()}`, description: `${this.selectedPlanDetails?.name} Cover` }
    });
    dialogRef.afterClosed().subscribe((result: PaymentResult | null) => { if (result?.success) this.router.navigate(['/dashboard']); });
  }
  
  getDurationText(value: string): string { return [...this.standardDurations, ...this.studentDurations].find(d => d.value === value)?.label || 'N/A'; }
  closeForm(): void { this.router.navigate(['/dashboard']); }
  abs(value: number): number { return Math.abs(value); }
  private resetPremium(): Premium { return { baseRateUSD: 0, subtotalUSD: 0, groupDiscountUSD: 0, ageSurchargeUSD: 0, winterSportsSurchargeUSD: 0, totalPayableUSD: 0, totalPayableKES: 0, groupDiscountPercentage: 0, ageAdjustmentPercentage: 0 }; }

  private initializePlans(): void {
    this.allTravelPlans = [
      // STANDARD PLANS - Fully populated from the first UI image
      { 
        id: 'AFRICA_ASIA', name: 'Africa/Asia', description: 'Value offer for Travelers outside of Europe', type: 'standard', tags: ['Africa', 'Asia'],
        benefits: [
          { name: 'Medical Expenses & Hospitalization abroad', included: true, limit: '€85,000' },
          { name: 'Excess', included: true, limit: '€50' },
          { name: 'Excess Applicable for Consultancy Quarantine Illness at Destination', included: false },
          { name: 'Emergency medical evacuation in case of illness or Accident', included: true, limit: '€85,000' },
          { name: 'Emergency Dental Care', included: true, limit: '€600' },
          { name: 'Excess', included: true, limit: '€25' },
          { name: 'Repatriation of mortal remains', included: true, limit: '€60,000' },
          { name: 'Repatriation of Family Member travelling with the Beneficiary to assist', included: true, limit: '€8,000' },
          { name: 'Emergency Return Home Following Death of a close Family member', included: false },
          { name: 'Extra-budgetary Emergency Visit', included: false },
          { name: 'Hijack and Consequential expenses', included: false },
        ]
      },
      { 
        id: 'EUROPE', name: 'Europe Basic', description: 'Value offer for Travel in Europe - Limits in Euros', type: 'standard', tags: ['Europe', 'Basic Coverage'],
        benefits: [
          { name: 'Medical Expenses & Hospitalization abroad', included: true, limit: '€36,000' },
          { name: 'Excess', included: true, limit: '€50' },
          { name: 'Excess Applicable for Consultancy Quarantine Illness at Destination', included: true },
          { name: 'Emergency medical evacuation in case of illness or Accident', included: true, limit: '€36,000' },
          { name: 'Emergency Dental Care', included: true, limit: '€500' },
          { name: 'Excess', included: true, limit: '€25' },
          { name: 'Repatriation of mortal remains', included: true, limit: '€60,000' },
          { name: 'Repatriation of Family Member travelling with the Beneficiary to assist', included: true, limit: '€6,000' },
          { name: 'Emergency Return Home Following Death of a close Family member', included: true, limit: 'Same Class Ticket' },
        ]
      },
      { 
        id: 'WW_BASIC', name: 'Worldwide Basic', description: 'Basic Worldwide Cover', type: 'standard', tags: ['Worldwide', 'Basic Coverage'], isMostPopular: true,
        benefits: [
          { name: 'Medical Expenses & Hospitalization abroad', included: true, limit: '€140,000' },
          { name: 'Excess', included: true, limit: '€50' },
          { name: 'Excess Applicable for Consultancy Quarantine Illness at Destination', included: true },
          { name: 'Emergency medical evacuation in case of illness or Accident', included: true, limit: '€140,000' },
          { name: 'Emergency Dental Care', included: true, limit: '€500' },
          { name: 'Excess', included: true, limit: '€25' },
          { name: 'Repatriation of mortal remains', included: true, limit: '€61,000' },
          { name: 'Repatriation of Family Member travelling with the Beneficiary to assist', included: true, limit: '€1,500' },
          { name: 'Emergency Return Home Following Death of a close Family member', included: true, limit: 'Same Class Ticket' },
          { name: 'Extra-budgetary Emergency Visit', included: true, limit: 'Same Class Ticket' },
          { name: 'Hijack and Consequential expenses', included: true, limit: '€250 day max' },
        ]
      },
      { 
        id: 'WW_PLUS', name: 'Worldwide Plus', description: 'Comprehensive Worldwide Travel Insurance', type: 'standard', tags: ['Worldwide', 'Plus Coverage'],
        benefits: [
          { name: 'Medical Expenses & Hospitalization abroad', included: true, limit: '€175,000' },
          { name: 'Excess', included: true, limit: '€50' },
          { name: 'Excess Applicable for Consultancy Quarantine Illness at Destination', included: true },
          { name: 'Emergency medical evacuation in case of illness or Accident', included: true, limit: '€175,000' },
          { name: 'Emergency Dental Care', included: true, limit: '€650' },
          { name: 'Excess', included: true, limit: '€25' },
          { name: 'Repatriation of mortal remains', included: true, limit: '€61,000' },
          { name: 'Repatriation of Family Member travelling with the Beneficiary to assist', included: true, limit: '€2,000' },
          { name: 'Emergency Return Home Following Death of a close Family member', included: true, limit: 'Same Class Ticket' },
          { name: 'Extra-budgetary Emergency Visit', included: true, limit: 'Same Class Ticket' },
        ]
      },
      { 
        id: 'WW_EXTRA', name: 'Worldwide Extra', description: 'Extra Protection whilst travelling', type: 'standard', tags: ['Worldwide', 'Extra Coverage'],
        benefits: [
          { name: 'Medical Expenses & Hospitalization abroad', included: true, limit: '€160,000' },
          { name: 'Excess', included: true, limit: '€50' },
          { name: 'Excess Applicable for Consultancy Quarantine Illness at Destination', included: true },
          { name: 'Emergency medical evacuation in case of illness or Accident', included: true, limit: '€160,000' },
          { name: 'Emergency Dental Care', included: true, limit: '€650' },
          { name: 'Excess', included: true, limit: '€25' },
          { name: 'Repatriation of mortal remains', included: true, limit: '€161,000' },
          { name: 'Repatriation of Family Member travelling with the Beneficiary to assist', included: true, limit: '€3,000' },
          { name: 'Emergency Return Home Following Death of a close Family member', included: true, limit: 'Same Class Ticket' },
          { name: 'Extra-budgetary Emergency Visit', included: true, limit: 'Return tickets in economy class and 1500 € per day max 10 days' },
        ]
      },
      
      // STUDENT PLANS - Fully populated from the second brochure image
      { 
        id: 'STUDENT_CLASSIC', name: 'Students Classic', description: 'Comprehensive worldwide cover for students.', type: 'student', tags: ['Worldwide', 'Student'],
        benefits: [
          { name: 'Medical expenses & hospitalization abroad - Covid-19', included: true, limit: 'USD 60,000', notes: 'Excess 70' },
          { name: 'Compulsory Quarantine in case of infection with Covid-19', included: true, limit: '$80 per day', notes: 'Max. 14 days' },
          { name: 'Emergency medical evacuation in case of illness or Accident', included: true, limit: 'USD 30,000' },
          { name: 'Emergency dental care', included: true, limit: 'USD 500', notes: 'Excess 70' },
          { name: 'Repatriation of mortal remains', included: true, limit: 'USD 15,000' },
          { name: 'Emergency return home following death of a close relative', included: true, limit: 'USD 2,000' },
          { name: 'Travel of one immediate family member', included: true, limit: 'USD 100 per day', notes: 'Max 10 days' },
          { name: '24 Hours Assistance Services', included: true, limit: 'Covered' },
          { name: 'Delivery of Medicines', included: true, limit: 'USD 1,000' },
          { name: 'Relay of Urgent messages', included: true, limit: 'Unlimited' },
          { name: 'Loss of Passport, driving license, national identity card abroad', included: true, limit: 'USD 300' },
          { name: 'Advance of Bail Bond', included: true, limit: 'USD 15,000' },
          { name: 'Personal Civil Liability', included: true, limit: 'USD 50,000', notes: 'Excess 150' },
          { name: 'Legal Defense', included: true, limit: 'USD 2,000' },
          { name: 'Winter Sports (suppression of exclusion)', included: true, limit: 'Available as an Option' },
        ]
      },
      { 
        id: 'STUDENT_PREMIUM', name: 'Students Premium', description: 'Enhanced worldwide protection for students.', type: 'student', tags: ['Worldwide', 'Premium'],
        benefits: [
          { name: 'Medical expenses & hospitalization abroad - Covid-19', included: true, limit: 'USD 100,000', notes: 'Excess 70' },
          { name: 'Compulsory Quarantine in case of infection with Covid-19', included: true, limit: '$80 per day', notes: 'Max. 14 days' },
          { name: 'Emergency medical evacuation in case of illness or Accident', included: true, limit: 'USD 50,000' },
          { name: 'Emergency dental care', included: true, limit: 'USD 500', notes: 'Excess 70' },
          { name: 'Repatriation of mortal remains', included: true, limit: 'USD 25,000' },
          { name: 'Emergency return home following death of a close relative', included: true, limit: 'USD 2,000' },
          { name: 'Travel of one immediate family member', included: true, limit: 'USD 100 per day', notes: 'Max 10 days' },
          { name: '24 Hours Assistance Services', included: true, limit: 'Covered' },
          { name: 'Delivery of Medicines', included: true, limit: 'USD 1,000' },
          { name: 'Relay of Urgent messages', included: true, limit: 'Unlimited' },
          { name: 'Loss of Passport, driving license, national identity card abroad', included: true, limit: 'USD 300' },
          { name: 'Advance of Bail Bond', included: true, limit: 'USD 20,000' },
          { name: 'Personal Civil Liability', included: true, limit: 'USD 50,000', notes: 'Excess 150' },
          { name: 'Legal Defense', included: true, limit: 'USD 2,000' },
          { name: 'Winter Sports (suppression of exclusion)', included: true, limit: 'Available as an Option' },
        ]
      },
    ];
  }
}