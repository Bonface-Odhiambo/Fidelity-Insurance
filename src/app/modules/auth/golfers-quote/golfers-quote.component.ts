import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, take, takeUntil } from 'rxjs';

// --- ASSUMED IMPORTS (Adjust paths if necessary) ---
import { MpesaPaymentModalComponent, PaymentResult } from '../shared/payment-modal.component';
import { AuthService } from 'app/core/auth/auth.service';

// --- Data Structures ---
interface CoverOption {
  id: 'A' | 'B' | 'C';
  name: string;
  premium: number;
  benefits: { name: string; limit: number; }[];
}

export interface PendingQuote {
    id: string;
    formData: any;
    selectedPlan: CoverOption;
    status: 'pending' | 'active';
    quoteDate: string;
}

// Custom validator function
export function dateNotInFuture(control: AbstractControl): ValidationErrors | null {
    const selectedDate = new Date(control.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
        return { futureDate: true };
    }
    return null;
}

@Component({
  selector: 'app-golfers-quote',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule, MatSnackBarModule, CurrencyPipe, DecimalPipe],
  templateUrl: './golfers-quote.component.html',
  styleUrls: ['./golfers-quote.component.scss']
})
export class GolfersQuoteComponent implements OnInit, OnDestroy {
  golferForm: FormGroup;
  selectedPlan: CoverOption | null = null;
  commissionAmount: number | null = null;
  private unsubscribe$ = new Subject<void>();
  
  readonly coverOptions: CoverOption[] = [
    { id: 'A', name: 'Option A', premium: 5000, benefits: [ { name: 'Golf Equipment', limit: 100000 }, { name: 'Personal Effects', limit: 10000 }, { name: 'Legal Liability', limit: 1000000 }, { name: 'Personal Accident', limit: 250000 }, { name: 'Hole in One', limit: 30000 } ] },
    { id: 'B', name: 'Option B', premium: 7500, benefits: [ { name: 'Golf Equipment', limit: 150000 }, { name: 'Personal Effects', limit: 10000 }, { name: 'Legal Liability', limit: 1000000 }, { name: 'Personal Accident', limit: 250000 }, { name: 'Hole in One', limit: 40000 } ] },
    { id: 'C', name: 'Option C', premium: 10000, benefits: [ { name: 'Golf Equipment', limit: 200000 }, { name: 'Personal Effects', limit: 10000 }, { name: 'Legal Liability', limit: 1000000 }, { name: 'Personal Accident', limit: 250000 }, { name: 'Hole in One', limit: 50000 } ] },
  ];

  constructor(
    private fb: FormBuilder, 
    private router: Router, 
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private authService: AuthService
    ) {
    this.golferForm = this.fb.group({
      policyHolderType: ['individual', Validators.required],
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      dob: ['', [Validators.required, dateNotInFuture]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^(01|07)\d{8}$/)]],
      kraPin: ['', [Validators.pattern(/^[A-Z]\d{9}[A-Z]$/i)]],
      golfClub: ['', Validators.required],
      intermediaryName: [''],
      intermediaryNumber: [''],
      intermediaryIdType: ['ira'],
      iraNumber: [''],
      corporateRegNumber: [''],
      coverOption: ['A', Validators.required],
      termsAndConditions: [false, Validators.requiredTrue],
    });
  }

  get f() { return this.golferForm.controls; }

  ngOnInit(): void {
    this.onPlanChange();
    this.setupDynamicValidators();
    this.golferForm.get('coverOption')?.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(() => this.onPlanChange());
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
  
  private setupDynamicValidators(): void {
    const typeControl = this.f.policyHolderType;
    const idTypeControl = this.f.intermediaryIdType;

    typeControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(type => {
      this.clearIntermediaryValidators();
      if (type === 'intermediary') {
        this.setIntermediaryValidators();
      }
      this.calculateCommission();
    });
    
    idTypeControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
        if (typeControl.value === 'intermediary') {
            this.setIntermediaryValidators();
        }
    });
  }

  private clearIntermediaryValidators(): void {
      const controls = ['intermediaryName', 'intermediaryNumber', 'iraNumber', 'corporateRegNumber'];
      controls.forEach(name => {
          this.golferForm.get(name)?.clearValidators();
          this.golferForm.get(name)?.setValue('');
          this.golferForm.get(name)?.updateValueAndValidity();
      });
  }

  private setIntermediaryValidators(): void {
      this.f.intermediaryName.setValidators([Validators.required]);
      this.f.intermediaryNumber.setValidators([Validators.required]);
      if (this.f.intermediaryIdType.value === 'ira') {
          this.f.iraNumber.setValidators([Validators.required]);
          this.f.corporateRegNumber.clearValidators();
          this.f.corporateRegNumber.setValue('');
      } else {
          this.f.corporateRegNumber.setValidators([Validators.required]);
          this.f.iraNumber.clearValidators();
          this.f.iraNumber.setValue('');
      }
      this.f.intermediaryName.updateValueAndValidity();
      this.f.intermediaryNumber.updateValueAndValidity();
      this.f.iraNumber.updateValueAndValidity();
      this.f.corporateRegNumber.updateValueAndValidity();
  }

  private calculateCommission(): void {
    if (this.f.policyHolderType.value === 'intermediary' && this.selectedPlan) {
        this.commissionAmount = this.selectedPlan.premium * 0.10;
    } else {
        this.commissionAmount = null;
    }
  }

  onPlanChange(): void {
    const selectedId = this.f.coverOption.value;
    this.selectedPlan = this.coverOptions.find(p => p.id === selectedId) || null;
    this.calculateCommission();
  }

  private saveQuote(): PendingQuote | null {
    if (this.golferForm.invalid || !this.selectedPlan) {
      this.golferForm.markAllAsTouched();
      return null;
    }
    const newQuote: PendingQuote = {
        id: `FID-GLF-${Date.now()}`,
        formData: this.golferForm.value,
        selectedPlan: this.selectedPlan,
        status: 'pending',
        quoteDate: new Date().toISOString()
    };
    const existingQuotes: PendingQuote[] = JSON.parse(localStorage.getItem('pendingQuotes') || '[]');
    existingQuotes.push(newQuote);
    localStorage.setItem('pendingQuotes', JSON.stringify(existingQuotes));
    return newQuote;
  }

  saveForLater(): void {
    const savedQuote = this.saveQuote();
    if (savedQuote) {
        this.snackBar.open('Your quote has been saved to the dashboard.', 'Close', { duration: 3000 });
        this.router.navigate(['/dashboard']);
    }
  }
  
  handlePayment(): void {
    const savedQuote = this.saveQuote();
    if (!savedQuote) return;
    this.authService.check().pipe(take(1)).subscribe((isAuthenticated) => {
        if (isAuthenticated) {
            this.openPaymentDialog(savedQuote);
        } else {
            this.snackBar.open('Please log in to pay for your policy.', 'Close', { duration: 5000 });
            this.router.navigate(['/']);
        }
    });
  }

  private openPaymentDialog(quote: PendingQuote): void {
    const dialogRef = this.dialog.open(MpesaPaymentModalComponent, {
      data: {
        amount: quote.selectedPlan.premium,
        phoneNumber: quote.formData.phoneNumber,
        reference: quote.id,
        description: `Golfers Insurance - ${quote.selectedPlan.name}`
      }
    });
    dialogRef.afterClosed().subscribe((result: PaymentResult | null) => {
      if (result?.success) {
        const allQuotes: PendingQuote[] = JSON.parse(localStorage.getItem('pendingQuotes') || '[]');
        const quoteIndex = allQuotes.findIndex(q => q.id === quote.id);
        if (quoteIndex > -1) {
            allQuotes[quoteIndex].status = 'active';
            localStorage.setItem('pendingQuotes', JSON.stringify(allQuotes));
        }
        this.snackBar.open('Payment successful! Your policy is now active.', 'Close', { duration: 5000 });
        this.router.navigate(['/dashboard']);
      }
    });
  }

  closeForm(): void {
    this.router.navigate(['/dashboard']);
  }
}