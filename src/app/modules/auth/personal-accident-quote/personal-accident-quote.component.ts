import { CommonModule, CurrencyPipe } from '@angular/common';
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  ChangeDetectorRef,
  OnDestroy, // <-- Ensure OnDestroy is imported
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// Angular Material Modules
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';

// Fuse UI components (assuming you have these)
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'personal-accident-quote',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatCheckboxModule,
    FuseAlertComponent,
    CurrencyPipe // For formatting currency in HTML
  ],
  templateUrl: './personal-accident-quote.component.html',
  styleUrls: ['./personal-accident-quote.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalAccidentQuoteComponent implements OnInit, OnDestroy { // <-- Implement OnDestroy
  private _formBuilder = inject(FormBuilder);
  private _router = inject(Router);
  private _cd = inject(ChangeDetectorRef);
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  personalAccidentForm!: FormGroup;
  showAlert: boolean = false;
  alert: { type: FuseAlertType; message: string } = {
    type: 'error',
    message: '',
  };
  calculatedPremium: number | null = null;

  // Data for the Cover Selected table
  benefits = [
    { name: 'Death', key: 'death' },
    { name: 'Accidental Permanent Total Disability', key: 'permanentTotalDisability' },
    { name: 'Hospital Cash', key: 'hospitalCash' },
    { name: 'Accidental Temporary Total Disability', key: 'temporaryTotalDisability' },
    { name: 'Accidental Medical Expense', key: 'medicalExpense' },
    { name: 'Artificial Appliances', key: 'artificialAppliances' },
    { name: 'Funeral Expenses', key: 'funeralExpenses' },
  ];

  // Define the options A-H and their corresponding values and premiums
  coverOptions = [
    {
      id: 'A',
      death: 250000, permanentTotalDisability: 250000, hospitalCash: 0,
      temporaryTotalDisability: 0, medicalExpense: 30000, artificialAppliances: 5000,
      funeralExpenses: 0,
      premiums: { '19-40': 1697, '41-70': 2702 }
    },
    {
      id: 'B',
      death: 500000, permanentTotalDisability: 500000, hospitalCash: 1500,
      temporaryTotalDisability: 2000, medicalExpense: 50000, artificialAppliances: 10000,
      funeralExpenses: 5000,
      premiums: { '19-40': 2702, '41-70': 3501 }
    },
    {
      id: 'C',
      death: 1000000, permanentTotalDisability: 1000000, hospitalCash: 3500,
      temporaryTotalDisability: 2500, medicalExpense: 100000, artificialAppliances: 10000,
      funeralExpenses: 10000,
      premiums: { '19-40': 5063, '41-70': 6569 }
    },
    {
      id: 'D',
      death: 2000000, permanentTotalDisability: 2000000, hospitalCash: 5500,
      temporaryTotalDisability: 3500, medicalExpense: 150000, artificialAppliances: 15000,
      funeralExpenses: 15000,
      premiums: { '19-40': 8779, '41-70': 11401 }
    },
    {
      id: 'E',
      death: 4000000, permanentTotalDisability: 4000000, hospitalCash: 8000,
      temporaryTotalDisability: 5000, medicalExpense: 200000, artificialAppliances: 20000,
      funeralExpenses: 20000,
      premiums: { '19-40': 15108, '41-70': 19628 }
    },
    {
      id: 'F',
      death: 6000000, permanentTotalDisability: 6000000, hospitalCash: 9000,
      temporaryTotalDisability: 8000, medicalExpense: 300000, artificialAppliances: 30000,
      funeralExpenses: 30000,
      premiums: { '19-40': 23144, '41-70': 27764 }
    },
    {
      id: 'G',
      death: 8000000, permanentTotalDisability: 8000000, hospitalCash: 10000,
      temporaryTotalDisability: 10000, medicalExpense: 400000, artificialAppliances: 40000,
      funeralExpenses: 40000,
      premiums: { '19-40': 31180, '41-70': 40521 }
    },
    {
      id: 'H',
      death: 10000000, permanentTotalDisability: 10000000, hospitalCash: 22000,
      temporaryTotalDisability: 15000, medicalExpense: 500000, artificialAppliances: 50000,
      funeralExpenses: 50000,
      premiums: { '19-40': 40220, '41-70': 52274 }
    }
  ];

  ageRanges = [
    { id: '19-40', label: 'Age 19 to 40' },
    { id: '41-70', label: 'Age 41 to 70' },
  ];

  ngOnInit(): void {
    this.personalAccidentForm = this._formBuilder.group({
      personalDetails: this._formBuilder.group({
        surname: ['', Validators.required],
        firstName: ['', Validators.required],
        middleName: [''],
        address: ['', Validators.required],
        postalCode: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        mobileNumber: ['', [Validators.required, Validators.pattern(/^\+?\d{7,15}$/)]],
        ageLastBirthday: ['', [Validators.required, Validators.min(18), Validators.max(70)]],
        passportIdNo: ['', Validators.required],
      }),
      beneficiaryDetails: this._formBuilder.group({
        beneficiaryName: ['', Validators.required],
        beneficiaryRelationship: ['', Validators.required],
      }),
      periodOfInsurance: this._formBuilder.group({
        fromDate: ['', Validators.required],
        toDate: ['', Validators.required],
      }),
      occupationClass: ['', Validators.required],
      hazardousActivities: ['', Validators.required],
      sustainedInjury: ['', Validators.required],
      injuryDetails: [''], // Conditionally required
      insurerDeclined: ['', Validators.required],
      freeFromIllness: ['', Validators.required],
      illnessDetails: [''], // Conditionally required
      engagedInExcludedActivities: ['', Validators.required],
      extensionOfCover: [''], // Conditionally required
      coverOption: ['', Validators.required], // User selects A-H
      ageRange: ['', Validators.required], // User selects age bracket
      signature: ['', Validators.required],
      declarationDate: ['', Validators.required],
      agreementAccepted: [false, Validators.requiredTrue],
    });

    this.setupConditionalValidators();

    // Subscribe to changes in coverOption and ageRange to recalculate premium
    this.personalAccidentForm.get('coverOption')?.valueChanges
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(() => this.calculatePremium());
    this.personalAccidentForm.get('ageRange')?.valueChanges
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(() => this.calculatePremium());
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(undefined); // FIX: Provide an argument here
    this._unsubscribeAll.complete();
  }

  private setupConditionalValidators(): void {
    const injuryControl = this.personalAccidentForm.get('sustainedInjury');
    const injuryDetailsControl = this.personalAccidentForm.get('injuryDetails');
    const illnessControl = this.personalAccidentForm.get('freeFromIllness');
    const illnessDetailsControl = this.personalAccidentForm.get('illnessDetails');
    const engagedActivitiesControl = this.personalAccidentForm.get('engagedInExcludedActivities');
    const extensionOfCoverControl = this.personalAccidentForm.get('extensionOfCover');

    injuryControl?.valueChanges.pipe(takeUntil(this._unsubscribeAll)).subscribe((value) => {
      if (value === true) {
        injuryDetailsControl?.setValidators(Validators.required);
      } else {
        injuryDetailsControl?.clearValidators();
        injuryDetailsControl?.setValue('');
      }
      injuryDetailsControl?.updateValueAndValidity();
      this._cd.markForCheck();
    });

    illnessControl?.valueChanges.pipe(takeUntil(this._unsubscribeAll)).subscribe((value) => {
      if (value === false) { // "If No, please give details"
        illnessDetailsControl?.setValidators(Validators.required);
      } else {
        illnessDetailsControl?.clearValidators();
        illnessDetailsControl?.setValue('');
      }
      illnessDetailsControl?.updateValueAndValidity();
      this._cd.markForCheck();
    });

    engagedActivitiesControl?.valueChanges.pipe(takeUntil(this._unsubscribeAll)).subscribe((value) => {
      if (value === true) {
        extensionOfCoverControl?.setValidators(Validators.required);
      } else {
        extensionOfCoverControl?.clearValidators();
        extensionOfCoverControl?.setValue(''); // Clear value if "No"
      }
      extensionOfCoverControl?.updateValueAndValidity();
      this._cd.markForCheck();
    });
  }

  calculatePremium(): void {
    const coverOptionId = this.personalAccidentForm.get('coverOption')?.value;
    const ageRangeId = this.personalAccidentForm.get('ageRange')?.value;
    const engagedInExcludedActivities = this.personalAccidentForm.get('engagedInExcludedActivities')?.value;
    const extensionOfCover = this.personalAccidentForm.get('extensionOfCover')?.value;

    if (coverOptionId && ageRangeId) {
      const selectedCover = this.coverOptions.find(opt => opt.id === coverOptionId);
      if (selectedCover) {
        let basePremium = selectedCover.premiums[ageRangeId];

        if (engagedInExcludedActivities === true && extensionOfCover === true) {
          // Add 25% to the basic premium if extension is selected
          basePremium = basePremium * 1.25;
        }
        this.calculatedPremium = basePremium;
      }
    } else {
      this.calculatedPremium = null;
    }
    this._cd.markForCheck();
  }

  getQuote(): void {
    this.showAlert = false;
    this.personalAccidentForm.markAllAsTouched();

    if (this.personalAccidentForm.invalid) {
      this.triggerAlert('error', 'Please fill in all required fields correctly to get a quote.', 'inline');
      return;
    }

    this.personalAccidentForm.disable(); // Disable form during submission

    // Simulate API call
    setTimeout(() => {
      // Here you would typically send the form data to your backend
      console.log('Personal Accident Quote Form Submitted:', this.personalAccidentForm.getRawValue());
      console.log('Calculated Premium:', this.calculatedPremium);

      this.triggerAlert('success', 'Your Personal Accident quote request has been submitted. We will contact you shortly.', 'inline');

      // Optionally, redirect or show a success screen
      // this._router.navigate(['/quote-confirmation']);

      this.personalAccidentForm.enable(); // Re-enable form after submission
      this.resetForm(); // Reset for a new quote
      this._cd.markForCheck();
    }, 2000);
  }

  resetForm(): void {
    this.personalAccidentForm.reset();
    this.personalAccidentForm.get('personalDetails.ageLastBirthday')?.setValue(''); // To clear number input default 0
    this.personalAccidentForm.get('ageRange')?.setValue(''); // Clear radio button
    this.personalAccidentForm.get('coverOption')?.setValue(''); // Clear radio button
    this.personalAccidentForm.get('agreementAccepted')?.setValue(false);
    this.calculatedPremium = null;
    this.showAlert = false;
    this.setupConditionalValidators(); // Re-apply conditional validators after reset
    this._cd.markForCheck();
  }

  private triggerAlert(type: FuseAlertType, message: string, position: 'inline'): void {
    this.alert = { type, message };
    this.showAlert = true;
    this._cd.markForCheck();
    // Hide alert after 5 seconds
    setTimeout(() => {
      this.showAlert = false;
      this._cd.markForCheck();
    }, 5000);
  }
}