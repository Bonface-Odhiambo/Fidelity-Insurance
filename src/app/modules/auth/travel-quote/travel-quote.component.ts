import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Subject, take, takeUntil } from 'rxjs';
import { MpesaPaymentModalComponent, PaymentResult } from '../shared/payment-modal.component';
import { AuthService } from 'app/core/auth/auth.service'; // Assuming AuthService exists

// --- Data Structures ---
interface TravelPlan { id: string; name: string; description: string; benefits: Benefit[]; type: 'standard' | 'student'; keyBenefits?: string[]; }
interface Benefit { name: string; limit: string; }
interface BenefitCategory { name: string; benefits: string[]; }
interface Premium {
  baseRateUSD: number; subtotalUSD: number; groupDiscountUSD: number; ageSurchargeUSD: number; winterSportsSurchargeUSD: number;
  totalPayableUSD: number; totalPayableKES: number; groupDiscountPercentage: number; ageAdjustmentPercentage: number;
}

@Component({
  selector: 'app-travel-quote',
  standalone: true,
  imports: [ CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, DatePipe ],
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
  readonly studentDurations = [ {value: '180', label: '6 months'}, {value: '270', label: '9 months'}, {value: '365', label: '1 year'} ];
  
  private unsubscribe$ = new Subject<void>();
  private readonly USD_TO_KES_RATE = 130.00;

  private standardRates: { [duration: string]: { [plan: string]: number } } = { '4': { 'AFRICA_ASIA': 9, 'EUROPE': 11, 'WW_BASIC': 15, 'WW_PLUS': 27, 'WW_EXTRA': 34 }, '7': { 'AFRICA_ASIA': 12, 'EUROPE': 15, 'WW_BASIC': 20, 'WW_PLUS': 36, 'WW_EXTRA': 43 }, '10': { 'AFRICA_ASIA': 17, 'EUROPE': 22, 'WW_BASIC': 28, 'WW_PLUS': 51, 'WW_EXTRA': 62 }, '15': { 'AFRICA_ASIA': 18, 'EUROPE': 25, 'WW_BASIC': 30, 'WW_PLUS': 55, 'WW_EXTRA': 67 }, '21': { 'AFRICA_ASIA': 20, 'EUROPE': 28, 'WW_BASIC': 32, 'WW_PLUS': 58, 'WW_EXTRA': 72 }, '31': { 'AFRICA_ASIA': 32, 'EUROPE': 38, 'WW_BASIC': 48, 'WW_PLUS': 90, 'WW_EXTRA': 111 }, '62': { 'AFRICA_ASIA': 50, 'EUROPE': 57, 'WW_BASIC': 70, 'WW_PLUS': 138, 'WW_EXTRA': 165 }, '92': { 'AFRICA_ASIA': 59, 'EUROPE': 74, 'WW_BASIC': 98, 'WW_PLUS': 179, 'WW_EXTRA': 202 }, '180': { 'AFRICA_ASIA': 70, 'EUROPE': 80, 'WW_BASIC': 106, 'WW_PLUS': 193, 'WW_EXTRA': 240 }, '365': { 'AFRICA_ASIA': 82, 'EUROPE': 103, 'WW_BASIC': 136, 'WW_PLUS': 248, 'WW_EXTRA': 295 }, };
  private studentRates: { [duration: string]: { [plan: string]: number } } = { '180': { 'STUDENT_CLASSIC': 361, 'STUDENT_PREMIUM': 496 }, '270': { 'STUDENT_CLASSIC': 470, 'STUDENT_PREMIUM': 626 }, '365': { 'STUDENT_CLASSIC': 602, 'STUDENT_PREMIUM': 715 }, };
  
  benefitCategories: BenefitCategory[] = [ { name: 'Medical & Emergency Assistance', benefits: ['Medical expenses & hospitalization abroad', 'Emergency medical evacuation' ]}, { name: 'Personal Accident / Liability', benefits: ['Personal Civil Liability', 'Accidental Death' ]}, { name: 'Cancellation & Delays', benefits: ['Journey Cancellation', 'Delayed Departure' ]} ];
  private allPlanBenefits: { [key: string]: { [key: string]: string } } = {
    'AFRICA_ASIA': { 'Medical expenses & hospitalization abroad': '$15,000', 'Emergency medical evacuation': '$15,000' },
    'EUROPE': { 'Medical expenses & hospitalization abroad': '€36,000', 'Emergency medical evacuation': '€36,000', 'Delayed Departure': '€300' },
    'WW_BASIC': { 'Medical expenses & hospitalization abroad': '$40,000', 'Personal Civil Liability': '$100,000', 'Journey Cancellation': '$2,000' },
    'WW_PLUS': { 'Medical expenses & hospitalization abroad': '$75,000', 'Personal Civil Liability': '$150,000' },
    'WW_EXTRA': { 'Medical expenses & hospitalization abroad': '$150,000', 'Accidental Death': '$50,000' },
    'STUDENT_CLASSIC': { 'Medical expenses & hospitalization abroad': '60,000', 'Emergency medical evacuation': '30,000', 'Personal Civil Liability': '50,000' },
    'STUDENT_PREMIUM': { 'Medical expenses & hospitalization abroad': '100,000', 'Emergency medical evacuation': '50,000', 'Personal Civil Liability': '50,000' },
  };
  
  constructor(private fb: FormBuilder, private router: Router, private dialog: MatDialog, private authService: AuthService) {
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

    // Specific listener ONLY for policyType changes
    this.qf.policyType.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(type => {
        this.updateDisplayedPlans(type);
    });
    
    // Listener for traveler details to recalculate premium in later steps
    this.travelerDetailsForm.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
        if (this.currentStep > 1) {
            this.calculatePremium();
        }
    });
  }

  ngOnDestroy(): void { this.unsubscribe$.next(); this.unsubscribe$.complete(); }
  
  updateDisplayedPlans(type: 'standard' | 'student'): void {
    this.displayedPlans = this.allTravelPlans.filter(p => p.type === type);
    // When policy type changes, reset the duration and plan selections
    // This is the correct place for this logic
    this.qf.duration.setValue('');
    this.qf.plan.setValue('');
  }

  getPlanPremium(planId: string): number {
    const { duration } = this.quoteForm.value;
    if (!duration) return 0;
    
    const isStudent = this.qf.policyType.value === 'student';
    const rateTable = isStudent ? this.studentRates : this.standardRates;
    const baseRateUSD = rateTable[duration]?.[planId] || 0;
    
    return baseRateUSD * this.USD_TO_KES_RATE;
  }

  getBenefitLimit(planId: string, benefitName: string): string {
    return this.allPlanBenefits[planId]?.[benefitName] || 'N/A';
  }
  
  calculatePremium(): void {
    if (this.quoteForm.invalid || this.travelerDetailsForm.invalid) {
      this.premium = this.resetPremium(); return;
    }

    const trip = this.quoteForm.value;
    const traveler = this.travelerDetailsForm.value;
    
    const rateTable = trip.policyType === 'student' ? this.studentRates : this.standardRates;
    const baseRateUSD = rateTable[trip.duration]?.[trip.plan] || 0;
    
    let subtotalUSD = baseRateUSD * traveler.numTravelers;

    let groupDiscountPercentage = 0;
    if (traveler.numTravelers >= 10) groupDiscountPercentage = 5;
    if (traveler.numTravelers >= 21) groupDiscountPercentage = 10;
    const groupDiscountUSD = subtotalUSD * (groupDiscountPercentage / 100);

    let ageAdjustmentPercentage = 0;
    const age = new Date().getFullYear() - new Date(traveler.dob).getFullYear();
    if (age >= 66) ageAdjustmentPercentage = 50;
    const ageSurchargeUSD = subtotalUSD * (ageAdjustmentPercentage / 100);
    
    const winterSportsSurchargeUSD = traveler.winterSports ? subtotalUSD * 1.00 : 0;
    const totalPayableUSD = subtotalUSD - groupDiscountUSD + ageSurchargeUSD + winterSportsSurchargeUSD;
    
    this.premium = {
      baseRateUSD, subtotalUSD, groupDiscountUSD, ageSurchargeUSD, winterSportsSurchargeUSD, totalPayableUSD,
      totalPayableKES: totalPayableUSD * this.USD_TO_KES_RATE,
      groupDiscountPercentage, ageAdjustmentPercentage
    };

    this.selectedPlanDetails = this.allTravelPlans.find(p => p.id === this.qf.plan.value) || null;
  }

  nextStep(): void { 
    if(this.currentStep === 1 && this.quoteForm.invalid) {
      this.quoteForm.markAllAsTouched();
      return;
    }
    if(this.currentStep === 2 && this.travelerDetailsForm.invalid) {
      this.travelerDetailsForm.markAllAsTouched();
      return;
    }
    if(this.currentStep < 3) {
      this.calculatePremium(); // ensure premium is calculated before moving to next step
      this.currentStep++;
    } 
  }
  prevStep(): void { if (this.currentStep > 1) this.currentStep--; }

  handlePayment(): void {
    if (this.travelerDetailsForm.invalid) return;
    this.authService.check().pipe(take(1)).subscribe(isAuthenticated => {
        if (isAuthenticated) {
            this.openPaymentDialog();
        } else {
            this.router.navigate(['/']);
        }
    });
  }

  private openPaymentDialog(): void {
    const dialogRef = this.dialog.open(MpesaPaymentModalComponent, {
      data: {
        amount: this.premium.totalPayableKES,
        phoneNumber: this.travelerDetailsForm.get('phoneNumber')?.value,
        reference: `FID-TRV-${Date.now()}`,
        description: `${this.selectedPlanDetails?.name} Cover`
      }
    });
    dialogRef.afterClosed().subscribe((result: PaymentResult | null) => { if (result?.success) this.router.navigate(['/dashboard']); });
  }
  
  getDurationText(value: string): string {
    const allDurations = [...this.standardDurations, ...this.studentDurations];
    return allDurations.find(d => d.value === value)?.label || 'N/A';
  }
  
  closeForm(): void { this.router.navigate(['/dashboard']); }
  abs(value: number): number { return Math.abs(value); }

  private resetPremium(): Premium { return { baseRateUSD: 0, subtotalUSD: 0, groupDiscountUSD: 0, ageSurchargeUSD: 0, winterSportsSurchargeUSD: 0, totalPayableUSD: 0, totalPayableKES: 0, groupDiscountPercentage: 0, ageAdjustmentPercentage: 0 }; }

  private initializePlans(): void {
    this.allTravelPlans = [
      { id: 'AFRICA_ASIA', name: 'Africa/Asia', description: 'Value cover for regional travel', type: 'standard', benefits: [] },
      { id: 'EUROPE', name: 'Europe Basic', description: 'Essential cover for Europe & Schengen', type: 'standard', benefits: [] },
      { id: 'WW_BASIC', name: 'Worldwide Basic', description: 'Basic worldwide cover for essentials', type: 'standard', benefits: [] },
      { id: 'WW_PLUS', name: 'Worldwide Plus', description: 'Comprehensive worldwide cover', type: 'standard', benefits: []},
      { id: 'WW_EXTRA', name: 'Worldwide Extra', description: 'Maximum protection for global travel', type: 'standard', benefits: []},
      { id: 'STUDENT_CLASSIC', name: 'Students Classic', description: 'Worldwide student cover', type: 'student', benefits: [] },
      { id: 'STUDENT_PREMIUM', name: 'Students Premium', description: 'Enhanced worldwide student cover', type: 'student', benefits: [] },
    ];
    this.allTravelPlans.forEach(plan => {
      plan.benefits = this.benefitCategories.flatMap(cat => cat.benefits)
        .map(bName => ({ name: bName, limit: this.getBenefitLimit(plan.id, bName) }))
        .filter(b => b.limit !== 'N/A');
    });
  }
}