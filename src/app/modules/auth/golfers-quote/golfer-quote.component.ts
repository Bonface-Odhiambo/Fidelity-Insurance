import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MpesaPaymentModalComponent, PaymentResult } from '../shared/payment-modal.component';

// --- Data Structures ---
interface CoverOption {
  id: 'A' | 'B' | 'C';
  name: string;
  premium: number;
  benefits: { name: string; limit: number; }[];
}

@Component({
  selector: 'app-golfers-quote',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatIconModule],
  templateUrl: './golfers-quote.component.html',
  styleUrls: ['./golfers-quote.component.scss']
})
export class GolfersQuoteComponent implements OnInit {
  golferForm: FormGroup;
  selectedPlan: CoverOption | null = null;
  
  readonly coverOptions: CoverOption[] = [
    {
      id: 'A', name: 'Option A', premium: 5000,
      benefits: [
        { name: 'Golf Equipment', limit: 100000 }, { name: 'Personal Effects', limit: 10000 },
        { name: 'Legal Liability', limit: 1000000 }, { name: 'Personal Accident', limit: 250000 },
        { name: 'Hole in One', limit: 30000 },
      ],
    },
    {
      id: 'B', name: 'Option B', premium: 7500,
      benefits: [
        { name: 'Golf Equipment', limit: 150000 }, { name: 'Personal Effects', limit: 10000 },
        { name: 'Legal Liability', limit: 1000000 }, { name: 'Personal Accident', limit: 250000 },
        { name: 'Hole in One', limit: 40000 },
      ],
    },
    {
      id: 'C', name: 'Option C', premium: 10000,
      benefits: [
        { name: 'Golf Equipment', limit: 200000 }, { name: 'Personal Effects', limit: 10000 },
        { name: 'Legal Liability', limit: 1000000 }, { name: 'Personal Accident', limit: 250000 },
        { name: 'Hole in One', limit: 50000 },
      ],
    },
  ];

  constructor(private fb: FormBuilder, private router: Router, private dialog: MatDialog) {
    this.golferForm = this.fb.group({
      fullName: ['', Validators.required],
      dob: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern('^07[0-9]{8}$')]],
      kraPin: [''],
      golfClub: ['', Validators.required],
      coverOption: ['A', Validators.required],
      termsAndConditions: [false, Validators.requiredTrue],
    });
  }

  ngOnInit(): void {
    this.onPlanChange();
    this.golferForm.get('coverOption')?.valueChanges.subscribe(() => this.onPlanChange());
  }
  
  onPlanChange(): void {
    const selectedId = this.golferForm.get('coverOption')?.value;
    this.selectedPlan = this.coverOptions.find(p => p.id === selectedId) || null;
  }
  
  handlePayment(): void {
    if (this.golferForm.invalid || !this.selectedPlan) return;
    
    const dialogRef = this.dialog.open(MpesaPaymentModalComponent, {
      data: {
        amount: this.selectedPlan.premium,
        phoneNumber: this.golferForm.get('phoneNumber')?.value,
        reference: `FID-GLF-${Date.now()}`,
        description: `Golfers Insurance - ${this.selectedPlan.name}`
      }
    });

    dialogRef.afterClosed().subscribe((result: PaymentResult | null) => {
      if (result?.success) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  closeForm(): void {
    this.router.navigate(['/dashboard']);
  }
}