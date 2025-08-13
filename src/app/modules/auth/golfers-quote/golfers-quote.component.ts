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
    { 
      id: 'A', 
      name: 'Option A', 
      premium: 3000, 
      benefits: [ 
          { name: 'Golf Equipment', limit: 100000 }, 
          { name: 'Personal Effects', limit: 10000 }, 
          { name: 'Legal Liability', limit: 1000000 }, 
          { name: 'Personal Accident', limit: 250000 }, 
          { name: 'Hole in One', limit: 30000 },
          { name: 'Medical Expenses for caddies', limit: 30000 }
      ] 
    },
    { 
      id: 'B', 
      name: 'Option B', 
      premium: 5000, 
      benefits: [ 
          { name: 'Golf Equipment', limit: 150000 }, 
          { name: 'Personal Effects', limit: 10000 }, 
          { name: 'Legal Liability', limit: 1000000 }, 
          { name: 'Personal Accident', limit: 250000 }, 
          { name: 'Hole in One', limit: 40000 },
          { name: 'Medical Expenses for caddies', limit: 30000 }
      ] 
    },
    { 
      id: 'C', 
      name: 'Option C', 
      premium: 6000, 
      benefits: [ 
          { name: 'Golf Equipment', limit: 200000 }, 
          { name: 'Personal Effects', limit: 10000 }, 
          { name: 'Legal Liability', limit: 1000000 }, 
          { name: 'Personal Accident', limit: 250000 }, 
          { name: 'Hole in One', limit: 50000 },
          { name: 'Medical Expenses for caddies', limit: 30000 }
      ] 
    },
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
      coverOption: ['A', Validators.required],
      termsAndConditions: [false, Validators.requiredTrue],
    });
  }

  get f() { return this.golferForm.controls; }

  ngOnInit(): void {
    this.onPlanChange(); // Set initial plan on load
    this.setupDynamicValidators();
    this.golferForm.get('coverOption')?.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(() => this.onPlanChange());
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  private setupDynamicValidators(): void {
    const typeControl = this.f.policyHolderType;

    typeControl.valueChanges.pipe(takeUntil(this.unsubscribe$)).subscribe(type => {
      const intermediaryName = this.golferForm.get('intermediaryName');
      const intermediaryNumber = this.golferForm.get('intermediaryNumber');

      if (type === 'intermediary') {
        intermediaryName?.setValidators([Validators.required]);
        intermediaryNumber?.setValidators([Validators.required]);
      } else {
        intermediaryName?.clearValidators();
        intermediaryNumber?.clearValidators();
        intermediaryName?.setValue('');
        intermediaryNumber?.setValue('');
      }
      intermediaryName?.updateValueAndValidity();
      intermediaryNumber?.updateValueAndValidity();
      this.calculateCommission();
    });
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
      this.snackBar.open('Please fill all required fields correctly.', 'Close', { duration: 3000 });
      return null;
    }
    const newQuote: PendingQuote = {
        id: `FID-GLF-${Date.now()}`,
        formData: this.golferForm.value,
        selectedPlan: this.selectedPlan,
        status: 'pending',
        quoteDate: new Date().toISOString()
    };
    const existingQuotes: PendingQuote[] = JSON.parse(localStorage.getItem('pendingGolfQuotes') || '[]');
    existingQuotes.push(newQuote);
    localStorage.setItem('pendingGolfQuotes', JSON.stringify(existingQuotes));
    return newQuote;
  }

  saveForLater(): void {
    const savedQuote = this.saveQuote();
    if (savedQuote) {
        this.snackBar.open('Your golfers quote has been saved.', 'Close', { duration: 3000 });
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
        const allQuotes: PendingQuote[] = JSON.parse(localStorage.getItem('pendingGolfQuotes') || '[]');
        const quoteIndex = allQuotes.findIndex(q => q.id === quote.id);
        if (quoteIndex > -1) {
            allQuotes[quoteIndex].status = 'active';
            localStorage.setItem('pendingGolfQuotes', JSON.stringify(allQuotes));
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